package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/go-git/go-billy/v5/osfs"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/pktline"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/protocol/packp"
	"github.com/go-git/go-git/v5/plumbing/transport"
	gitsrv "github.com/go-git/go-git/v5/plumbing/transport/server"
	"github.com/google/uuid"
	"github.com/mtolmacs/planemgr/internal/server/auth"
	"github.com/mtolmacs/planemgr/internal/server/chart"
)

type chartResponse struct {
	ChartID string `json:"chartId,omitempty"`
}

type chartListResponse struct {
	ChartIDs []string `json:"chartIds"`
}

type chartTreeResponse struct {
	ChartID string   `json:"chartId"`
	Ref     string   `json:"ref"`
	Files   []string `json:"files"`
}

type chartCommitResponse struct {
	ChartID string   `json:"chartId"`
	Ref     string   `json:"ref"`
	Files   []string `json:"files"`
}

type chartFileResponse struct {
	ChartID  string `json:"chartId"`
	Ref      string `json:"ref"`
	Path     string `json:"path"`
	Contents string `json:"contents"`
}

type chartFileUpdate struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type chartCommitRequest struct {
	Message string            `json:"message"`
	Files   []chartFileUpdate `json:"files"`
}

// Handle /api/chart requests.
func HandleChartCollection(w http.ResponseWriter, r *http.Request) {
	if err := auth.RequireAccessToken(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		HandleChartList(w, r)
	case http.MethodPost:
		HandleChartCreate(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Handle GET /api/chart requests.
// @Summary List charts
// @Description Lists all available charts.
// @Tags chart
// @Security BearerAuth
// @Success 200 {object} chartListResponse
// @Router /chart [get]
func HandleChartList(w http.ResponseWriter, _ *http.Request) {
	charts, err := chart.ListChartRepos()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list charts"})
		return
	}

	writeJSON(w, http.StatusOK, chartListResponse{
		ChartIDs: charts,
	})
}

// Handle POST /api/chart requests.
// @Summary Create chart
// @Description Creates a new chart.
// @Tags chart
// @Security BearerAuth
// @Success 201 {object} chartResponse
// @Router /chart [post]
func HandleChartCreate(w http.ResponseWriter, _ *http.Request) {
	chartID, err := chart.CreateChartRepo()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create chart"})
		return
	}

	_, err = chart.WriteChartFiles(chartID, []chart.FileUpdate{
		{
			Path:    "main.tf.json",
			Content: "{}",
		},
	}, "Initialization")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to initialize chart"})
		return
	}

	writeJSON(w, http.StatusCreated, chartResponse{
		ChartID: chartID,
	})
}

// Handle /api/chart/{id} requests.
func HandleChartEntity(w http.ResponseWriter, r *http.Request) {
	if err := auth.RequireAccessToken(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodHead:
		HandleChartHead(w, r)
	case http.MethodGet:
		HandleChartFileGet(w, r)
	case http.MethodPut:
		HandleChartPut(w, r)
	default:
		w.Header().Set("Allow", "HEAD, GET, PUT")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Handle HEAD /api/chart/{id} requests.
// @Summary List chart files
// @Description Returns a recursive listing of files for a chart at a ref.
// @Tags chart
// @Security BearerAuth
// @Param id path string true "Chart ID"
// @Param ref query string false "Git ref (defaults to HEAD)"
// @Success 200 {object} chartTreeResponse
// @Router /chart/{id} [head]
func HandleChartHead(w http.ResponseWriter, r *http.Request) {
	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	ref := r.URL.Query().Get("ref")
	resolvedRef, files, err := chart.ListChartTree(chartID, ref)
	if err != nil {
		if errors.Is(err, git.ErrRepositoryNotExists) || errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart not found"})
			return
		}
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart ref not found"})
			return
		}

		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list chart files"})
		return
	}

	writeJSON(w, http.StatusOK, chartTreeResponse{
		ChartID: chartID,
		Ref:     resolvedRef,
		Files:   files,
	})
}

// Handle GET /api/chart/{id} requests.
// @Summary Get chart file
// @Description Returns the contents of a file in a chart at a ref.
// @Tags chart
// @Security BearerAuth
// @Param id path string true "Chart ID"
// @Param file query string true "File path in the chart repo"
// @Param ref query string false "Git ref (defaults to HEAD)"
// @Success 200 {object} chartFileResponse
// @Router /chart/{id} [get]
func HandleChartFileGet(w http.ResponseWriter, r *http.Request) {
	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	filePath := r.URL.Query().Get("file")
	if filePath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file required"})
		return
	}

	ref := r.URL.Query().Get("ref")
	resolvedRef, contents, err := chart.ReadChartFile(chartID, filePath, ref)
	if err != nil {
		if errors.Is(err, git.ErrRepositoryNotExists) || errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart not found"})
			return
		}
		if errors.Is(err, plumbing.ErrReferenceNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart ref not found"})
			return
		}
		if errors.Is(err, object.ErrFileNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart file not found"})
			return
		}

		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read chart file"})
		return
	}

	writeJSON(w, http.StatusOK, chartFileResponse{
		ChartID:  chartID,
		Ref:      resolvedRef,
		Path:     filePath,
		Contents: contents,
	})
}

// Handle PUT /api/chart/{id} requests.
// @Summary Create or replace whole files in chart
// @Description Writes files to a chart and commits the change.
// @Tags chart
// @Security BearerAuth
// @Param id path string true "Chart ID"
// @Param request body chartCommitRequest true "Commit payload"
// @Success 200 {object} chartCommitResponse
// @Router /chart/{id} [put]
func HandleChartPut(w http.ResponseWriter, r *http.Request) {
	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	var req chartCommitRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.Message) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message required"})
		return
	}
	if len(req.Files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "files required"})
		return
	}

	updates := make([]chart.FileUpdate, 0, len(req.Files))
	paths := make([]string, 0, len(req.Files))
	for _, file := range req.Files {
		if file.Path == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file path required"})
			return
		}
		updates = append(updates, chart.FileUpdate{
			Path:    file.Path,
			Content: file.Content,
		})
		paths = append(paths, file.Path)
	}

	commitRef, err := chart.WriteChartFiles(chartID, updates, req.Message)
	if err != nil {
		if errors.Is(err, chart.ErrInvalidPath) || errors.Is(err, chart.ErrPathIsDirectory) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid file path"})
			return
		}
		if errors.Is(err, git.ErrRepositoryNotExists) || errors.Is(err, os.ErrNotExist) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart not found"})
			return
		}

		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to write chart file"})
		return
	}

	writeJSON(w, http.StatusOK, chartCommitResponse{
		ChartID: chartID,
		Ref:     commitRef,
		Files:   paths,
	})
}

// HandleChartGit serves a read-only smart HTTP git endpoint for chart repos.
func HandleChartGit(w http.ResponseWriter, r *http.Request) {
	if err := auth.RequireAccessTokenFromBasicAuth(r, "access"); err != nil {
		w.Header().Set("WWW-Authenticate", `Basic realm="planemgr"`)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	trimmedChartID := strings.TrimSuffix(chartID, ".git")
	if _, err := uuid.Parse(trimmedChartID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid chart id"})
		return
	}

	basePath := "/api/chart/" + chartID
	suffix := strings.TrimPrefix(r.URL.Path, basePath)
	switch suffix {
	case "", "/":
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "git endpoint requires a service path"})
	case "/info/refs":
		handleChartGitInfoRefs(w, r, trimmedChartID)
	case "/git-upload-pack":
		handleChartGitUploadPack(w, r, trimmedChartID)
	case "/git-receive-pack":
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "pushes are disabled"})
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown git endpoint"})
	}
}

func handleChartGitInfoRefs(w http.ResponseWriter, r *http.Request, chartID string) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	service := r.URL.Query().Get("service")
	if service == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "service required"})
		return
	}
	if service != transport.UploadPackServiceName {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "service not supported"})
		return
	}

	session, err := chartUploadPackSession(chartID)
	if err != nil {
		handleChartGitSessionError(w, err)
		return
	}
	defer session.Close()

	advRefs, err := session.AdvertisedReferences()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to advertise refs"})
		return
	}
	advRefs.Prefix = [][]byte{
		[]byte("# service=git-upload-pack"),
		pktline.Flush,
	}

	var buf bytes.Buffer
	if err := advRefs.Encode(&buf); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to encode refs"})
		return
	}

	w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Pragma", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf.Bytes())
}

func handleChartGitUploadPack(w http.ResponseWriter, r *http.Request, chartID string) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	session, err := chartUploadPackSession(chartID)
	if err != nil {
		handleChartGitSessionError(w, err)
		return
	}
	defer session.Close()

	req := packp.NewUploadPackRequest()
	if err := req.Decode(r.Body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid upload-pack request"})
		return
	}

	resp, err := session.UploadPack(r.Context(), req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to serve pack"})
		return
	}

	w.Header().Set("Content-Type", "application/x-git-upload-pack-result")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Pragma", "no-cache")
	w.WriteHeader(http.StatusOK)
	_ = resp.Encode(w)
}

func chartUploadPackSession(chartID string) (transport.UploadPackSession, error) {
	dir := osfs.New(chart.ChartWorkdir() + "/" + chartID)
	loader := gitsrv.NewFilesystemLoader(dir)
	srv := gitsrv.NewServer(loader)
	return srv.NewUploadPackSession(&transport.Endpoint{}, nil)
}

func handleChartGitSessionError(w http.ResponseWriter, err error) {
	if errors.Is(err, transport.ErrRepositoryNotFound) || errors.Is(err, os.ErrNotExist) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "chart not found"})
		return
	}

	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to open chart repository"})
}
