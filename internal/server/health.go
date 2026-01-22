package server

import (
	"net/http"
	"time"
)

type healthResponse struct {
	Status string `json:"status"`
	Time   string `json:"time"`
}

// HandleHealth godoc
// @Summary Health check
// @Description Returns the API status.
// @Tags health
// @Success 200 {object} healthResponse
// @Router /health [get]
func HandleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{
		Status: "ok",
		Time:   time.Now().UTC().Format(time.RFC3339),
	})
}
