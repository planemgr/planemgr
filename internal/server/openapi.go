package server

import (
	"net/http"

	docs "github.com/mtolmacs/planemgr/internal/server/docs"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

func handleOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write([]byte(docs.SwaggerInfo.ReadDoc()))
}

func handleDocs() http.Handler {
	return httpSwagger.Handler(
		httpSwagger.URL("/api/openapi.json"),
	)
}

func handleDocsRedirect(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/api/doc/", http.StatusMovedPermanently)
}
