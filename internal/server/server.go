package server

import (
	"net/http"
)

// New wires the API routes and optional static asset handler.
func New() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", HandleHealth)
	mux.HandleFunc("/api/auth", HandleAuth)
	mux.HandleFunc("/api/user", HandleUser)
	mux.HandleFunc("/api/deploy", HandleDeploy)
	mux.HandleFunc("/api/chart", HandleChartCollection)
	mux.HandleFunc("/api/chart/{id}", HandleChartEntity)
	mux.HandleFunc("/api/chart/{id}/", HandleChartGit)
	mux.HandleFunc("/api/openapi.json", HandleOpenAPI)
	mux.HandleFunc("/api/docs", HandleDocsRedirect)
	mux.Handle("/api/docs/", HandleDocs())
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
