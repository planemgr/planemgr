package server

import (
	"net/http"
)

// New wires the API routes and optional static asset handler.
func New() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/chart", handleChartCollection)
	mux.HandleFunc("/api/chart/{id}", handleChartEntity)
	mux.HandleFunc("/api/openapi.json", handleOpenAPI)
	mux.HandleFunc("/api/docs", handleDocsRedirect)
	mux.Handle("/api/docs/", handleDocs())
	mux.Handle("/api/", http.HandlerFunc(handleApiNotFound))

	if static, ok := staticFS(); ok {
		mux.Handle("/", spaHandler(static))
	} else {
		mux.Handle("/", http.NotFoundHandler())
	}

	return mux
}

func handleApiNotFound(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown endpoint"})
}
