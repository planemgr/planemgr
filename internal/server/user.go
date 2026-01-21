package server

import (
	"encoding/json"
	"net/http"

	"github.com/mtolmacs/planemgr/internal/server/auth"
)

// handleUser godoc
// @Tags user
func handleUser(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		handleUserRegister(w, r)
	case http.MethodGet:
		handleUserInfo(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
	}
}

// handleUserRegister godoc
// @Summary Set the user name and password
// @Description Accepts credentials for the single-user setup and validates they match the configured environment.
// @Tags user
// @Accept json
// @Produce json
// @Param credentials body authRequest true "User credentials"
// @Success 201 {object} emptyResponse
// @Failure 400 {object} errorResponse
// @Failure 401 {object} errorResponse
// @Router /user [post]
func handleUserRegister(w http.ResponseWriter, r *http.Request) {
	if r.Body == nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "missing request body"})
		return
	}

	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "invalid JSON payload"})
		return
	}

	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "username and password are required"})
		return
	}

	if !auth.CredentialsMatch(req.Username, req.Password) {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized", Message: "invalid credentials"})
		return
	}

	writeJSON(w, http.StatusCreated, emptyResponse{})
}

// handleUserInfo godoc
// @Summary Return user info
// @Description Returns any available user info when the bearer token is valid.
// @Tags user
// @Security BearerAuth
// @Produce json
// @Success 200 {object} emptyResponse
// @Failure 401 {object} errorResponse
// @Router /user [get]
func handleUserInfo(w http.ResponseWriter, r *http.Request) {
	if err := auth.RequireAccessToken(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized", Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, emptyResponse{})
}
