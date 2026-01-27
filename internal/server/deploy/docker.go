package deploy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/mount"
	"github.com/moby/moby/client"
)

var ErrInvalidRef = errors.New("Deploy ref is required")
var ErrUnsupportedRunner = errors.New("Unsupported runner type")
var ErrInvalidWorkdir = errors.New("Deployment workdir missing or invalid")
var ErrMissingSSHKey = errors.New("Ssh keys are required for deployment")

type Result struct {
	ExitCode    int64
	Output      string
	RunnerImage string
}

func RunDockerDeploy(
	ctx context.Context,
	token string,
	id string,
	ref string,
	subject string,
	publicKey string,
	privateKey string,
) (Result, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return Result{}, ErrInvalidRef
	}

	runnerImage, err := resolveRunnerImage()
	if err != nil {
		return Result{}, err
	}

	cli, err := client.New(client.FromEnv)
	if err != nil {
		return Result{}, fmt.Errorf("Create docker client: %w", err)
	}
	defer cli.Close()

	subject = strings.TrimSpace(subject)
	if subject == "" {
		return Result{}, ErrInvalidWorkdir
	}
	if subject != filepath.Base(subject) || strings.Contains(subject, "/") || strings.Contains(subject, "\\") {
		return Result{}, ErrInvalidWorkdir
	}
	if strings.TrimSpace(publicKey) == "" || strings.TrimSpace(privateKey) == "" {
		return Result{}, ErrMissingSSHKey
	}

	serviceAddress := os.Getenv("SERVICE_ADDRESS")
	if serviceAddress == "" {
		serviceAddress = "host.docker.internal:4000"
	}

	repo := fmt.Sprintf("http://access:%s@%s/api/chart/%s.git", token, serviceAddress, id)

	config := &container.Config{
		Image: runnerImage,
		Tty:   true,
		Env: []string{
			fmt.Sprintf("DEPLOY_REPO=%s", repo),
			fmt.Sprintf("DEPLOY_REF=%s", ref),
			"GIT_TERMINAL_PROMPT=0",
		},
		Cmd: []string{
			"sh",
			"-c",
			`while [ ! -s /runner/.ssh/id_ed25519 ] || [ ! -s /runner/.ssh/id_ed25519.pub ]; do sleep 0.05; done && ` +
				`git clone "$DEPLOY_REPO" && ` +
				"cd " + id + " && " +
				`git switch --detach "$DEPLOY_REF" && ` +
				"tofu validate --json && " +
				"tofu apply -auto-approve --json",
		},
	}
	hostConfig := &container.HostConfig{
		// Use host networking so the runner can reach localhost-bound services.
		NetworkMode: "host",
		// Store credentials in a container tmpfs to avoid host disk writes.
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeTmpfs,
				Target: "/runner/.ssh",
				TmpfsOptions: &mount.TmpfsOptions{
					Mode: 0o700,
				},
			},
		},
	}

	resp, err := cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Config:     config,
		HostConfig: hostConfig,
	})
	if err != nil {
		return Result{}, fmt.Errorf("Create deploy container: %w", err)
	}
	containerID := resp.ID
	defer func() {
		_, _ = cli.ContainerRemove(ctx, containerID, client.ContainerRemoveOptions{Force: true})
	}()

	if _, err := cli.ContainerStart(ctx, containerID, client.ContainerStartOptions{}); err != nil {
		return Result{}, fmt.Errorf("Start deploy container: %w", err)
	}

	if err := writeSSHKeysToContainer(ctx, cli, containerID, publicKey, privateKey); err != nil {
		return Result{}, err
	}

	waitResult := cli.ContainerWait(ctx, containerID, client.ContainerWaitOptions{
		Condition: container.WaitConditionNotRunning,
	})
	var statusCode int64
	select {
	case err := <-waitResult.Error:
		if err != nil {
			return Result{}, fmt.Errorf("Wait for deploy container: %w", err)
		}
	case status := <-waitResult.Result:
		statusCode = status.StatusCode
	}

	logs, err := cli.ContainerLogs(ctx, containerID, client.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return Result{}, fmt.Errorf("Read deploy logs: %w", err)
	}
	defer logs.Close()

	outputBytes, err := io.ReadAll(logs)
	if err != nil {
		return Result{}, fmt.Errorf("Read deploy output: %w", err)
	}

	output := strings.TrimSpace(string(outputBytes))
	result := Result{
		ExitCode:    statusCode,
		Output:      output,
		RunnerImage: runnerImage,
	}
	if statusCode != 0 {
		return result, fmt.Errorf("Deploy failed: exit %d\n%s", statusCode, output)
	}

	return result, nil
}

func resolveRunnerImage() (string, error) {
	customImage := strings.TrimSpace(os.Getenv("RUNNER_IMAGE"))
	switch strings.TrimSpace(os.Getenv("RUNNER_IMAGE")) {
	case "":
		return "planemgr/runner:latest", nil
	default:
		return customImage, nil
	}
}

func writeSSHKeysToContainer(
	ctx context.Context,
	cli *client.Client,
	containerID string,
	publicKey string,
	privateKey string,
) error {
	privateKey, err := normalizeSSHKey(privateKey)
	if err != nil {
		return err
	}
	publicKey, err = normalizeSSHKey(publicKey)
	if err != nil {
		return err
	}

	if err := execWriteFile(ctx, cli, containerID, "/runner/.ssh/id_ed25519", privateKey, 0o600); err != nil {
		return err
	}
	if err := execWriteFile(ctx, cli, containerID, "/runner/.ssh/id_ed25519.pub", publicKey, 0o644); err != nil {
		return err
	}

	return nil
}

func normalizeSSHKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", ErrMissingSSHKey
	}
	if !strings.HasSuffix(trimmed, "\n") {
		trimmed += "\n"
	}
	return trimmed, nil
}

func execWriteFile(
	ctx context.Context,
	cli *client.Client,
	containerID string,
	path string,
	contents string,
	perm os.FileMode,
) error {
	execCreate, err := cli.ExecCreate(ctx, containerID, client.ExecCreateOptions{
		AttachStdin:  true,
		AttachStderr: true,
		AttachStdout: true,
		Cmd: []string{
			"sh",
			"-c",
			fmt.Sprintf("umask 077; mkdir -p /runner/.ssh; cat > %s; chmod %04o %s", path, perm, path),
		},
	})
	if err != nil {
		return fmt.Errorf("Create ssh key exec: %w", err)
	}

	attach, err := cli.ExecAttach(ctx, execCreate.ID, client.ExecAttachOptions{})
	if err != nil {
		return fmt.Errorf("Attach ssh key exec: %w", err)
	}
	defer attach.Close()

	if _, err := attach.Conn.Write([]byte(contents)); err != nil {
		return fmt.Errorf("Send ssh key to container: %w", err)
	}
	if err := attach.CloseWrite(); err != nil {
		return fmt.Errorf("Close ssh key exec input: %w", err)
	}
	_, _ = io.Copy(io.Discard, attach.Reader)

	inspect, err := cli.ExecInspect(ctx, execCreate.ID, client.ExecInspectOptions{})
	if err != nil {
		return fmt.Errorf("Inspect ssh key exec: %w", err)
	}
	if inspect.ExitCode != 0 {
		return fmt.Errorf("Write ssh key failed: exit %d", inspect.ExitCode)
	}

	return nil
}
