package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/mtolmacs/planemgr/internal/server/auth"
	"github.com/mtolmacs/planemgr/internal/server/user"
)

// HandleUser godoc
// @Tags user
func HandleUser(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		HandleUserRegister(w, r)
	case http.MethodGet:
		HandleUserInfo(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method_not_allowed"})
	}
}

type userRegisterRequest struct {
	Username      string `json:"username"`
	Password      string `json:"password"`
	SSHPublicKey  string `json:"ssh_public_key,omitempty"`
	SSHPrivateKey string `json:"ssh_private_key,omitempty"`
}

type userInfoResponse struct {
	SSHPublicKey string `json:"ssh_public_key"`
}

// HandleUserRegister godoc
// @Summary Set the user name and password
// @Description Accepts credentials for the single-user setup, optionally storing an SSH keypair or generating one.
// @Tags user
// @Accept json
// @Produce json
// @Param credentials body userRegisterRequest true "User credentials"
// @Success 201 {object} emptyResponse
// @Failure 400 {object} errorResponse
// @Failure 401 {object} errorResponse
// @Failure 500 {object} errorResponse
// @Router /user [post]
func HandleUserRegister(w http.ResponseWriter, r *http.Request) {
	if r.Body == nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "missing request body"})
		return
	}

	var req userRegisterRequest
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

	exists, err := user.UserKeyPairExists(req.Username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "key_lookup_failed", Message: err.Error()})
		return
	}
	if exists {
		writeJSON(w, http.StatusConflict, errorResponse{Error: "ssh_keypair_exists", Message: "ssh key pair already exists for user"})
		return
	}

	publicKey := strings.TrimSpace(req.SSHPublicKey)
	privateKey := strings.TrimSpace(req.SSHPrivateKey)
	if publicKey == "" && privateKey == "" {
		publicKey, privateKey, err = user.GenerateEd25519KeyPair()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "key_generation_failed", Message: err.Error()})
			return
		}
	} else {
		if publicKey == "" || privateKey == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "ssh_public_key and ssh_private_key must be provided together"})
			return
		}
		if err := user.ValidateSSHKeyPair(publicKey, privateKey); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: err.Error()})
			return
		}
	}

	if err := user.StoreUserKeyPair(req.Username, publicKey, privateKey); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "key_store_failed", Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, emptyResponse{})
}

// HandleUserInfo godoc
// @Summary Return user info
// @Description Returns any available user info when the bearer token is valid.
// @Tags user
// @Security BearerAuth
// @Produce json
// @Success 200 {object} userInfoResponse
// @Failure 401 {object} errorResponse
// @Router /user [get]
func HandleUserInfo(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.RequireAccessTokenClaims(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized", Message: err.Error()})
		return
	}

	publicKey, err := user.LoadUserPublicKey(claims.Subject)
	if err != nil {
		status := http.StatusInternalServerError
		code := "key_load_failed"
		if errors.Is(err, os.ErrNotExist) {
			status = http.StatusNotFound
			code = "ssh_public_key_not_found"
		}
		writeJSON(w, status, errorResponse{Error: code, Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, userInfoResponse{SSHPublicKey: publicKey})
}
