package custom

import (
	"log"
	"os"

	"github.com/mtolmacs/planemgr/runner"
)

func EnsureRunnerImage() {
	if custom_image := os.Getenv("RUNNER_IMAGE"); custom_image != "" {
		log.Print("Initializing custom runner image...")
		version, err := runner.TestRunnerImage(custom_image)
		if err != nil {
			log.Fatalf("Custom runner \"%s\" initialization failed: %v", custom_image, err)
			return
		}

		log.Printf("Custom runner image \"%s\" ready (%s)", custom_image, version)
	}
}
