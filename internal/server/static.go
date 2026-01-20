package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

func spaHandler(static fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(static))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		cleanPath := path.Clean(r.URL.Path)
		if strings.Contains(cleanPath, "..") {
			http.NotFound(w, r)
			return
		}

		if cleanPath == "/" {
			cleanPath = "/index.html"
		}

		requested := strings.TrimPrefix(cleanPath, "/")
		if fileExists(static, requested) {
			clone := r.Clone(r.Context())
			clone.URL.Path = cleanPath
			fileServer.ServeHTTP(w, clone)
			return
		}

		clone := r.Clone(r.Context())
		clone.URL.Path = "/index.html"
		fileServer.ServeHTTP(w, clone)
	})
}
