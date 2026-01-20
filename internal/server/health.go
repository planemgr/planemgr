package server

import (
	"net/http"
	"time"
)

type healthResponse struct {
	Status string `json:"status"`
	Time   string `json:"time"`
}

// handleHealth godoc
// @Summary Health check
// @Description Returns the API status.
// @Tags health
// @Success 200 {object} healthResponse
// @Router /health [get]
func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{
		Status: "ok",
		Time:   time.Now().UTC().Format(time.RFC3339),
	})
}
