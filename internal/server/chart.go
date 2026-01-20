package server

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/google/uuid"
)

type chartResponse struct {
	ChartID string `json:"chartId,omitempty"`
}

type chartListResponse struct {
	ChartIDs []string `json:"chartIds"`
}

type chartTreeResponse struct {
	ChartID string   `json:"chartId"`
	Ref     string   `json:"ref,omitempty"`
	Files   []string `json:"files"`
}

// Handle /api/chart requests.
func handleChartCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleChartList(w, r)
	case http.MethodPost:
		handleChartCreate(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// Handle GET /api/chart requests.
// @Summary List charts
// @Description Lists all available charts.
// @Tags chart
// @Success 200 {object} chartListResponse
// @Router /chart [get]
func handleChartList(w http.ResponseWriter, _ *http.Request) {
	charts, err := listChartRepos()
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
// @Success 201 {object} chartResponse
// @Router /chart [post]
func handleChartCreate(w http.ResponseWriter, _ *http.Request) {
	chartID, err := createChartRepo()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create chart"})
		return
	}

	writeJSON(w, http.StatusCreated, chartResponse{
		ChartID: chartID,
	})
}

// Handle GET /api/chart/{id}/tree requests.
// @Summary List chart files
// @Description Returns a recursive listing of files for a chart at a ref.
// @Tags chart
// @Param id path string true "Chart ID"
// @Param ref query string false "Git ref (defaults to HEAD)"
// @Success 200 {object} chartTreeResponse
// @Router /chart/{id}/tree [get]
func handleChartTree(w http.ResponseWriter, r *http.Request) {
	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	ref := r.URL.Query().Get("ref")
	resolvedRef, files, err := listChartTree(chartID, ref)
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

func chartWorkdir() string {
	workdir := os.Getenv("WORKDIR")
	if workdir == "" {
		workdir = "./srv"
	}
	return workdir
}

func createChartRepo() (string, error) {
	workdir := chartWorkdir()
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return "", err
	}

	for attempts := 0; attempts < 5; attempts++ {
		chartID := uuid.New().String()
		repoPath := filepath.Join(workdir, chartID)
		if _, err := os.Stat(repoPath); err == nil {
			continue
		} else if !errors.Is(err, os.ErrNotExist) {
			return "", err
		}

		if err := initBareRepo(repoPath); err != nil {
			return "", err
		}

		return chartID, nil
	}

	return "", errors.New("unable to allocate chart id")
}

func listChartRepos() ([]string, error) {
	workdir := chartWorkdir()
	entries, err := os.ReadDir(workdir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, err
	}

	var chartIDs = []string{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		chartIDs = append(chartIDs, entry.Name())
	}

	sort.Strings(chartIDs)
	return chartIDs, nil
}

func listChartTree(chartID, ref string) (string, []string, error) {
	workdir := chartWorkdir()
	repoPath := filepath.Join(workdir, chartID)
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return "", nil, err
	}

	if ref == "" {
		head, err := repo.Head()
		if err != nil {
			if errors.Is(err, plumbing.ErrReferenceNotFound) {
				return "", []string{}, nil
			}
			return "", nil, err
		}

		ref = head.Hash().String()
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return "", nil, err
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return "", nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return "", nil, err
	}

	files := []string{}
	if err := tree.Files().ForEach(func(file *object.File) error {
		files = append(files, file.Name)
		return nil
	}); err != nil {
		return "", nil, err
	}

	sort.Strings(files)
	return hash.String(), files, nil
}

func initBareRepo(path string) error {
	repo, err := git.PlainInit(path, true)
	if err != nil {
		return err
	}

	head := plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.NewBranchReferenceName("main"))
	return repo.Storer.SetReference(head)
}
