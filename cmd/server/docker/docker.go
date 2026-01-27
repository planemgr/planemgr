//go:build !dev

package docker

import (
	"context"
	"fmt"
	"io"
	"log"
	"regexp"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

func TestRunnerImage(tag string) (string, error) {
	log.Printf(`Verifying runner image "%s" is working`, tag)

	cli, err := client.New(client.FromEnv)
	if err != nil {
		return "", fmt.Errorf("Create docker client: %w", err)
	}
	defer cli.Close()

	ctx := context.Background()
	config := &container.Config{
		Cmd: []string{"tofu", "-v"},
		Tty: true,
	}
	resp, err := cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Config: config,
		Image:  tag,
	})
	if err != nil {
		return "", fmt.Errorf("Create runner container: %w", err)
	}
	containerID := resp.ID
	defer func() {
		_, _ = cli.ContainerRemove(ctx, containerID, client.ContainerRemoveOptions{Force: true})
	}()

	if _, err := cli.ContainerStart(ctx, containerID, client.ContainerStartOptions{}); err != nil {
		return "", fmt.Errorf("Start runner container: %w", err)
	}

	waitResult := cli.ContainerWait(ctx, containerID, client.ContainerWaitOptions{
		Condition: container.WaitConditionNotRunning,
	})
	var statusCode int64
	select {
	case err := <-waitResult.Error:
		if err != nil {
			return "", fmt.Errorf("Wait for runner container: %w", err)
		}
	case status := <-waitResult.Result:
		statusCode = status.StatusCode
	}

	logs, err := cli.ContainerLogs(ctx, containerID, client.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return "", fmt.Errorf("Read runner logs: %w", err)
	}
	defer logs.Close()

	outputBytes, err := io.ReadAll(logs)
	if err != nil {
		return "", fmt.Errorf("Read runner output: %w", err)
	}

	re := regexp.MustCompile(`\s+`)
	output := re.ReplaceAllString(string(outputBytes), " ")
	if statusCode != 0 {
		return "", fmt.Errorf("Runner validation failed: exit %d\n%s", statusCode, output)
	}

	return output, nil
}
