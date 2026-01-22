package server

import (
	"encoding/json"
	"net/http"

	"github.com/mtolmacs/planemgr/internal/server/auth"
)

type authRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

type errorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

type emptyResponse struct{}

// HandleAuth godoc
// @Tags auth
func HandleAuth(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		HandleAuthLogin(w, r)
	case http.MethodGet:
		HandleAuthRefresh(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
	}
}

// HandleAuthLogin godoc
// @Summary Log in
// @Description Issues access and refresh tokens using the configured single-user credentials.
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body authRequest true "User credentials"
// @Success 200 {object} authResponse
// @Failure 400 {object} errorResponse
// @Failure 401 {object} errorResponse
// @Failure 500 {object} errorResponse
// @Router /auth [post]
func HandleAuthLogin(w http.ResponseWriter, r *http.Request) {
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

	accessToken, refreshToken, expiresIn, err := auth.IssueTokens(req.Username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "token_error", Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
	})
}

// HandleAuthRefresh godoc
// @Summary Refresh access token
// @Description Issues a new access token using a refresh token in the Authorization header or refresh_token query param.
// @Tags auth
// @Param refresh_token query string true "Refresh token"
// @Produce json
// @Success 200 {object} authResponse
// @Failure 401 {object} errorResponse
// @Failure 500 {object} errorResponse
// @Router /auth [get]
func HandleAuthRefresh(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.RequireRefreshToken(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized", Message: err.Error()})
		return
	}

	accessToken, newRefreshToken, expiresIn, err := auth.IssueTokens(claims.Subject)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "token_error", Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    expiresIn,
	})
}
