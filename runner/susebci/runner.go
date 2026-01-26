//go:build !dev

package susebci

import (
	"archive/tar"
	"bufio"
	"context"
	"crypto"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/moby/moby/client"
	"github.com/sigstore/cosign/v2/pkg/cosign"
	"github.com/sigstore/sigstore/pkg/signature"

	runner "github.com/mtolmacs/planemgr/runner"
)

const RUNNER_DIR = "runner/susebci"

// EnsureRunnerImage verifies the base image signature, builds the runner image,
// and validates opentofu is runnable.
func EnsureRunnerImage() {
	log.Print("Initializing susebci runner image...")

	dockerfilePath := filepath.Join(RUNNER_DIR, "Dockerfile")
	baseImage, err := readRunnerImageArg(dockerfilePath)
	if err != nil {
		log.Fatalf("Susebci runner initialization failed: %v", err)
		return
	}

	keyPath := filepath.Join(RUNNER_DIR, "registry.suse.com.pem")
	if err := verifyImageSignature(baseImage, keyPath); err != nil {
		log.Fatalf("Susebci runner initialization failed: %v", err)
		return
	}

	tag := strings.TrimSpace(os.Getenv("RUNNER_IMAGE"))
	if tag == "" {
		tag = "planemgr/runner"
	}
	tag = fmt.Sprintf("%s:latest", tag)

	if err := buildRunnerImage(tag, RUNNER_DIR); err != nil {
		log.Fatalf("Susebci runner initialization failed: %v", err)
		return
	}

	version, err := runner.TestRunnerImage(tag)
	if err != nil {
		log.Fatalf("Susebci runner initialization failed: %v", err)
		return
	}

	log.Printf("Runner image SUSE BCI ready (%s)", version)
}

// Parse out the RUNNER_IMAGE arg from the Dockerfile.
func readRunnerImageArg(dockerfilePath string) (string, error) {
	file, err := os.Open(dockerfilePath)
	if err != nil {
		return "", fmt.Errorf("open dockerfile: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "ARG RUNNER_IMAGE") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			return "", fmt.Errorf("RUNNER_IMAGE arg missing default in %s", dockerfilePath)
		}
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		if value == "" {
			return "", fmt.Errorf("RUNNER_IMAGE arg empty in %s", dockerfilePath)
		}
		return value, nil
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("scan dockerfile: %w", err)
	}
	return "", fmt.Errorf("RUNNER_IMAGE arg not found in %s", dockerfilePath)
}

func verifyImageSignature(image, keyPath string) error {
	if _, err := os.Stat(keyPath); err != nil {
		return fmt.Errorf("signature key missing: %w", err)
	}

	verifier, err := signature.LoadVerifierFromPEMFile(keyPath, crypto.SHA256)
	if err != nil {
		return fmt.Errorf("Load cosign public key: %w", err)
	}

	ctx := context.Background()

	ref, err := name.ParseReference(image)
	if err != nil {
		return fmt.Errorf("Parse image reference: %w", err)
	}

	opts := &cosign.CheckOpts{
		SigVerifier: verifier,
	}
	if _, _, err := cosign.VerifyImageSignatures(ctx, ref, opts); err != nil {
		return fmt.Errorf("Cosign verify failed for %s: %w", image, err)
	}
	return nil
}

func buildRunnerImage(tag, runnerDir string) error {
	cli, err := client.New(client.FromEnv)
	if err != nil {
		return fmt.Errorf("Create docker client: %w", err)
	}
	defer cli.Close()

	// Stream the build context directly so the runner can build without a docker CLI.
	buildContext, err := createBuildContext(runnerDir)
	if err != nil {
		return fmt.Errorf("create docker build context: %w", err)
	}
	defer buildContext.Close()

	ctx := context.Background()
	resp, err := cli.ImageBuild(ctx, buildContext, client.ImageBuildOptions{
		Tags:   []string{tag},
		Remove: true,
	})
	if err != nil {
		return fmt.Errorf("docker build failed: %w", err)
	}
	defer resp.Body.Close()

	if err := consumeDockerBuildOutput(resp.Body); err != nil {
		return err
	}
	return nil
}

// createBuildContext packages the runner directory as a tar stream for ImageBuild.
func createBuildContext(root string) (io.ReadCloser, error) {
	pipeReader, pipeWriter := io.Pipe()
	tarWriter := tar.NewWriter(pipeWriter)

	go func() {
		defer func() {
			_ = tarWriter.Close()
			_ = pipeWriter.Close()
		}()

		walkErr := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if path == root {
				return nil
			}

			info, err := entry.Info()
			if err != nil {
				return err
			}
			relPath, err := filepath.Rel(root, path)
			if err != nil {
				return err
			}

			header, err := tar.FileInfoHeader(info, "")
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(relPath)
			if info.Mode()&os.ModeSymlink != 0 {
				linkTarget, err := os.Readlink(path)
				if err != nil {
					return err
				}
				header.Linkname = linkTarget
			}

			if err := tarWriter.WriteHeader(header); err != nil {
				return err
			}
			if !info.Mode().IsRegular() {
				return nil
			}

			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			if _, err := io.Copy(tarWriter, file); err != nil {
				return err
			}
			return nil
		})

		if walkErr != nil {
			_ = pipeWriter.CloseWithError(walkErr)
		}
	}()

	return pipeReader, nil
}

type dockerBuildMessage struct {
	Error       string `json:"error"`
	ErrorDetail struct {
		Message string `json:"message"`
	} `json:"errorDetail"`
}

func consumeDockerBuildOutput(reader io.Reader) error {
	decoder := json.NewDecoder(reader)
	for {
		var msg dockerBuildMessage
		if err := decoder.Decode(&msg); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			return fmt.Errorf("decode docker build output: %w", err)
		}
		if msg.Error != "" {
			return fmt.Errorf("docker build failed: %s", msg.Error)
		}
		if msg.ErrorDetail.Message != "" {
			return fmt.Errorf("docker build failed: %s", msg.ErrorDetail.Message)
		}
	}
}
