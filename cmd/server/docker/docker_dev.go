//go:build dev

package docker

import "log"

func TestRunnerImage(tag string) (string, error) {
	log.Printf("Skipping runner image test in dev mode for image: %s", tag)
	return "", nil
}
