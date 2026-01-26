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

var ErrInvalidRef = errors.New("deploy ref is required")
var ErrUnsupportedRunner = errors.New("unsupported runner type")
var ErrInvalidWorkdir = errors.New("deployment workdir missing or invalid")

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
	secureStore := os.Getenv("SECURE_STORE")
	if secureStore == "" {
		return Result{}, ErrInvalidWorkdir
	}
	secureStorePath, err := filepath.Abs(secureStore)
	if err != nil {
		return Result{}, fmt.Errorf("Resolve secure store path: %w", err)
	}
	securePath := filepath.Join(secureStorePath, subject)
	if _, err := os.Stat(securePath); err != nil {
		if os.IsNotExist(err) {
			return Result{}, fmt.Errorf("Ssh key store not found: %w", os.ErrNotExist)
		}
		return Result{}, fmt.Errorf("Stat ssh key store: %w", err)
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
		// Bind mount user SSH keys into the runner's .ssh directory.
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   securePath,
				Target:   "/runner/.ssh",
				ReadOnly: true,
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
