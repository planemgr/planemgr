package main

import (
	"log"
	"net/http"
	"os"
	"time"

	// Keep swag tool dependencies in the module for docs generation.
	_ "golang.org/x/text/unicode/bidi"

	"github.com/mtolmacs/planemgr/internal/server"
)

func main() {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "4000"
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
