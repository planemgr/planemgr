package auth

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	accessTokenTTL  = 15 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
)

type tokenClaims struct {
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
}

var ErrLoggedOut = errors.New("User is logged out")

var privateKeyStore = struct {
	mu   sync.RWMutex
	keys map[string]string
}{
	keys: map[string]string{},
}

func IssueTokens(subject string) (string, string, int64, error) {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		return "", "", 0, errors.New("SESSION_SECRET is not configured")
	}

	now := time.Now().UTC()
	accessClaims := tokenClaims{
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(accessTokenTTL)),
		},
	}
	refreshClaims := tokenClaims{
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshTokenTTL)),
		},
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(secret))
	if err != nil {
		return "", "", 0, err
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(secret))
	if err != nil {
		return "", "", 0, err
	}

	return accessToken, refreshToken, int64(accessTokenTTL.Seconds()), nil
}

func ParseToken(token string) (*tokenClaims, error) {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		return nil, errors.New("SESSION_SECRET is not configured")
	}

	claims := &tokenClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}))
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func RequireAccessTokenClaims(r *http.Request) (*tokenClaims, error) {
	token := BearerToken(r)
	if token == "" {
		return nil, errors.New("missing bearer token")
	}

	claims, err := ParseToken(token)
	if err != nil {
		return nil, err
	}
	if claims.TokenType != "access" {
		return nil, errors.New("invalid token type")
	}
	if _, ok := PrivateKeyForSubject(claims.Subject); !ok {
		return nil, ErrLoggedOut
	}

	return claims, nil
}

func RequireAccessTokenFromBasicAuth(r *http.Request, expectedUser string) error {
	user, token, ok := r.BasicAuth()
	if !ok || user != expectedUser || strings.TrimSpace(token) == "" {
		return errors.New("missing basic auth token")
	}

	claims, err := ParseToken(token)
	if err != nil {
		return err
	}
	if claims.TokenType != "access" {
		return errors.New("invalid token type")
	}
	if _, ok := PrivateKeyForSubject(claims.Subject); !ok {
		return ErrLoggedOut
	}

	return nil
}

func RequireRefreshToken(r *http.Request) (*tokenClaims, error) {
	token := RefreshTokenFromRequest(r)
	if token == "" {
		return nil, errors.New("missing refresh token")
	}

	claims, err := ParseToken(token)
	if err != nil {
		return nil, err
	}
	if claims.TokenType != "refresh" {
		return nil, errors.New("invalid token type")
	}
	if _, ok := PrivateKeyForSubject(claims.Subject); !ok {
		return nil, ErrLoggedOut
	}

	return claims, nil
}

func BearerToken(r *http.Request) string {
	value := r.Header.Get("Authorization")
	if value == "" {
		return ""
	}

	parts := strings.Fields(value)
	return parts[0]
}

func RefreshTokenFromRequest(r *http.Request) string {
	if token := BearerToken(r); token != "" {
		return token
	}

	return r.URL.Query().Get("refresh_token")
}

func StorePrivateKey(subject, privateKey string) {
	privateKey = strings.TrimSpace(privateKey)
	privateKeyStore.mu.Lock()
	defer privateKeyStore.mu.Unlock()
	if privateKey == "" {
		delete(privateKeyStore.keys, subject)
		return
	}
	privateKeyStore.keys[subject] = privateKey
}

func PrivateKeyForSubject(subject string) (string, bool) {
	privateKeyStore.mu.RLock()
	defer privateKeyStore.mu.RUnlock()
	privateKey, ok := privateKeyStore.keys[subject]
	return privateKey, ok
}
