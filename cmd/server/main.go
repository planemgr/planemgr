package main

import (
	"errors"
	"log"
	"net/http"
	"os"
	"time"

	// Keep swag tool dependencies in the module for docs generation.
	_ "golang.org/x/text/unicode/bidi"

	"github.com/joho/godotenv"
	"github.com/mtolmacs/planemgr/internal/server"
	"github.com/mtolmacs/planemgr/runner/custom"
	"github.com/mtolmacs/planemgr/runner/susebci"
)

func main() {
	loadEnvFiles()

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "4000"
	}

	// Ensure the runner image is ready.
	switch os.Getenv("RUNNER_IMAGE") {
	case "":
		susebci.EnsureRunnerImage()
	default:
		custom.EnsureRunnerImage()
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           server.New(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Planerider listening on http://localhost:%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func loadEnvFiles() {
	files := []string{
		".env",
		".env.local",
		".env.development",
		".env.development.local",
		".env.test",
		".env.test.local",
		".env.production",
		".env.production.local",
	}

	for _, file := range files {
		if err := godotenv.Overload(file); err != nil && !errors.Is(err, os.ErrNotExist) {
			log.Printf("Skipping env file load (%s): %v", file, err)
		}
	}
}
