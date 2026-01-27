package server

import (
	"io"
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

		requested := strings.TrimPrefix(cleanPath, "/")
		if requested != "" && requested != "index.html" && fileExists(static, requested) {
			clone := r.Clone(r.Context())
			clone.URL.Path = cleanPath
			fileServer.ServeHTTP(w, clone)
			return
		}

		if serveIndex(w, r, static) {
			return
		}

		http.NotFound(w, r)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, static fs.FS) bool {
	file, err := static.Open("index.html")
	if err != nil {
		return false
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || info.IsDir() {
		return false
	}

	if seeker, ok := file.(io.ReadSeeker); ok {
		http.ServeContent(w, r, "index.html", info.ModTime(), seeker)
		return true
	}

	data, err := fs.ReadFile(static, "index.html")
	if err != nil {
		return false
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return true
	}

	_, _ = w.Write(data)
	return true
}
