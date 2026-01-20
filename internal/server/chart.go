package server

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/go-git/go-git/v5"
	"github.com/google/uuid"
)

type chartResponse struct {
	ChartID string `json:"chartId,omitempty"`
}

type chartListResponse struct {
	ChartIDs []string `json:"chartIds"`
}

// handleChartCollection routes chart collection requests to method-specific handlers.
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

// handleChartList godoc
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

// handleChartCreate godoc
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

// handleChartEntity routes chart entity requests to method-specific handlers.
func handleChartEntity(w http.ResponseWriter, r *http.Request) {
	chartID := r.PathValue("id")
	if chartID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "chart id required"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		handleChartGet(w, r, chartID)
	case http.MethodPatch:
		handleChartPatch(w, r, chartID)
	case http.MethodDelete:
		handleChartDelete(w, r, chartID)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// handleChartGet godoc
// @Summary Get chart
// @Description Returns a single chart and its nodes.
// @Tags chart
// @Param id path string true "Chart ID"
// @Success 200 {object} chartResponse
// @Router /chart/{id} [get]
func handleChartGet(w http.ResponseWriter, _ *http.Request, chartID string) {
	// TODO: return the chart nodes once the storage layer is wired.
	writeJSON(w, http.StatusOK, chartResponse{
		ChartID: chartID,
	})
}

// handleChartPatch godoc
// @Summary Update chart
// @Description Applies node updates to a chart.
// @Tags chart
// @Param id path string true "Chart ID"
// @Success 200 {object} chartResponse
// @Router /chart/{id} [patch]
func handleChartPatch(w http.ResponseWriter, _ *http.Request, chartID string) {
	// TODO: apply node updates once the chart update contract is defined.
	writeJSON(w, http.StatusOK, chartResponse{
		ChartID: chartID,
	})
}

// handleChartDelete godoc
// @Summary Delete chart
// @Description Deletes a chart.
// @Tags chart
// @Param id path string true "Chart ID"
// @Success 204
// @Router /chart/{id} [delete]
func handleChartDelete(w http.ResponseWriter, _ *http.Request, _ string) {
	// TODO: remove the chart once the backing storage is defined.
	w.WriteHeader(http.StatusNoContent)
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

func initBareRepo(path string) error {
	_, err := git.PlainInit(path, true)
	return err
}
