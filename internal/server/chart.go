package server

import "net/http"

type chartResponse struct {
	Message string `json:"message"`
	ChartID string `json:"chartId,omitempty"`
}

type chartListResponse struct {
	Message string `json:"message"`
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
	// TODO: return all charts once the storage layer is wired.
	writeJSON(w, http.StatusOK, chartListResponse{Message: "chart list placeholder"})
}

// handleChartCreate godoc
// @Summary Create chart
// @Description Creates a new chart.
// @Tags chart
// @Success 201 {object} chartListResponse
// @Router /chart [post]
func handleChartCreate(w http.ResponseWriter, _ *http.Request) {
	// TODO: create a chart once the storage layer is wired.
	writeJSON(w, http.StatusCreated, chartListResponse{Message: "chart create placeholder"})
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
		Message: "chart list placeholder",
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
		Message: "chart update placeholder",
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
