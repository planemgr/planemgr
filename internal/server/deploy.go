package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/mtolmacs/planemgr/internal/server/auth"
	"github.com/mtolmacs/planemgr/internal/server/deploy"
	"github.com/mtolmacs/planemgr/internal/server/user"
)

type deployRequest struct {
	Id  string `json:"id"`
	Ref string `json:"ref"`
}

type deployResponse struct {
	Ref         string `json:"ref"`
	RunnerImage string `json:"runnerImage"`
	ExitCode    int64  `json:"exitCode"`
	Output      string `json:"output,omitempty"`
}

var deployLocks = struct {
	mu    sync.Mutex
	locks map[string]struct{}
}{
	locks: map[string]struct{}{},
}

func tryAcquireDeployLock(id string) bool {
	deployLocks.mu.Lock()
	defer deployLocks.mu.Unlock()
	if _, exists := deployLocks.locks[id]; exists {
		return false
	}
	deployLocks.locks[id] = struct{}{}
	return true
}

func releaseDeployLock(id string) {
	deployLocks.mu.Lock()
	defer deployLocks.mu.Unlock()
	delete(deployLocks.locks, id)
}

// HandleDeploy handles /api/deploy requests.
// @Summary Deploy a ref
// @Description Runs tofu verify and tofu apply for a git ref using the configured runner image.
// @Tags deploy
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body deployRequest true "Deploy request"
// @Success 200 {object} deployResponse
// @Failure 400 {object} errorResponse
// @Failure 401 {object} errorResponse
// @Failure 409 {object} errorResponse
// @Failure 500 {object} errorResponse
// @Router /deploy [post]
func HandleDeploy(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.RequireAccessTokenClaims(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodPost:
		privateKey, ok := auth.PrivateKeyForSubject(claims.Subject)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized", Message: auth.ErrLoggedOut.Error()})
			return
		}
		HandleDeployCreate(w, r, claims.Subject, privateKey)
	default:
		w.Header().Set("Allow", "POST")
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "Method_not_allowed"})
	}
}

// HandleDeployCreate handles POST /api/deploy requests.
func HandleDeployCreate(w http.ResponseWriter, r *http.Request, subject, privateKey string) {
	if r.Body == nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "Missing request body"})
		return
	}

	var req deployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid_request", Message: "Invalid JSON payload"})
		return
	}

	if _, err := uuid.Parse(req.Id); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid chart id"})
		return
	}
	if !tryAcquireDeployLock(req.Id) {
		writeJSON(w, http.StatusConflict, errorResponse{Error: "deploy_in_progress", Message: "another deploy is already running"})
		return
	}
	defer releaseDeployLock(req.Id)

	token := auth.BearerToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "Unauthorized"})
		return
	}

	publicKey, err := user.LoadUserPublicKey(subject)
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

	result, err := deploy.RunDockerDeploy(
		r.Context(),
		token,
		req.Id,
		req.Ref,
		subject,
		publicKey,
		privateKey,
	)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, deploy.ErrInvalidRef) || errors.Is(err, deploy.ErrUnsupportedRunner) || errors.Is(err, deploy.ErrInvalidWorkdir) || errors.Is(err, deploy.ErrMissingSSHKey) {
			status = http.StatusBadRequest
		}
		if errors.Is(err, os.ErrNotExist) {
			status = http.StatusNotFound
		}
		writeJSON(w, status, errorResponse{Error: "deploy_failed", Message: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, deployResponse{
		Ref:         req.Ref,
		RunnerImage: result.RunnerImage,
		ExitCode:    result.ExitCode,
		Output:      result.Output,
	})
}
