package user

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/ssh"
)

const defaultSecureStore = "./secure"

type keyPair struct {
	publicKey  string
	privateKey string
}

func GenerateEd25519KeyPair() (string, string, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", fmt.Errorf("generate ed25519 key pair: %w", err)
	}

	sshPublicKey, err := ssh.NewPublicKey(publicKey)
	if err != nil {
		return "", "", fmt.Errorf("marshal ssh public key: %w", err)
	}

	privateKeyBlock, err := ssh.MarshalPrivateKey(privateKey, "planemgr@local")
	if err != nil {
		return "", "", fmt.Errorf("marshal ssh private key: %w", err)
	}

	return strings.TrimSpace(string(ssh.MarshalAuthorizedKey(sshPublicKey))),
		strings.TrimSpace(string(pem.EncodeToMemory(privateKeyBlock))),
		nil
}

func ValidateSSHKeyPair(publicKey, privateKey string) error {
	parsedPublicKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(publicKey))
	if err != nil {
		return fmt.Errorf("invalid ssh_public_key: %w", err)
	}

	signer, err := ssh.ParsePrivateKey([]byte(privateKey))
	if err != nil {
		return fmt.Errorf("invalid ssh_private_key: %w", err)
	}

	if !bytes.Equal(parsedPublicKey.Marshal(), signer.PublicKey().Marshal()) {
		return errors.New("ssh_public_key does not match ssh_private_key")
	}

	return nil
}

func StoreUserKeyPair(username, publicKey, privateKey, password string) error {
	// Persist SSH keys under SECURE_STORE/<username> with locked-down permissions.
	storeDir := secureStoreDir()
	if err := ensureSecureDir(storeDir); err != nil {
		return err
	}

	paths, err := buildUserKeyPaths(storeDir, username)
	if err != nil {
		return err
	}

	if err := ensureSecureDir(filepath.Dir(paths.privateKey)); err != nil {
		return err
	}

	encryptedPrivateKey, err := EncryptPrivateKey(password, privateKey)
	if err != nil {
		return err
	}

	publicContent := strings.TrimSpace(publicKey) + "\n"
	privateContent := strings.TrimSpace(encryptedPrivateKey) + "\n"

	if err := writeSecureFile(paths.privateKey, privateContent, 0o600); err != nil {
		return err
	}

	if err := writeSecureFile(paths.publicKey, publicContent, 0o644); err != nil {
		return err
	}

	return nil
}

func UserKeyPairExists(username string) (bool, error) {
	storeDir := secureStoreDir()
	paths, err := buildUserKeyPaths(storeDir, username)
	if err != nil {
		return false, err
	}

	publicExists, err := fileExists(paths.publicKey)
	if err != nil {
		return false, fmt.Errorf("check public key: %w", err)
	}

	privateExists, err := fileExists(paths.privateKey)
	if err != nil {
		return false, fmt.Errorf("check private key: %w", err)
	}

	return publicExists || privateExists, nil
}

func LoadUserPublicKey(username string) (string, error) {
	storeDir := secureStoreDir()
	paths, err := buildUserKeyPaths(storeDir, username)
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(paths.publicKey)
	if err != nil {
		return "", fmt.Errorf("read public key: %w", err)
	}

	return strings.TrimSpace(string(data)), nil
}

func LoadUserEncryptedPrivateKey(username string) (string, error) {
	storeDir := secureStoreDir()
	paths, err := buildUserKeyPaths(storeDir, username)
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(paths.privateKey)
	if err != nil {
		return "", fmt.Errorf("read private key: %w", err)
	}

	return strings.TrimSpace(string(data)), nil
}

func LoadUserPrivateKey(username, password string) (string, error) {
	encrypted, err := LoadUserEncryptedPrivateKey(username)
	if err != nil {
		return "", err
	}

	return DecryptPrivateKey(password, encrypted)
}

func secureStoreDir() string {
	if dir := strings.TrimSpace(os.Getenv("SECURE_STORE")); dir != "" {
		return dir
	}
	return defaultSecureStore
}

func ensureSecureDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return fmt.Errorf("ensure secure dir: %w", err)
	}
	if err := os.Chmod(path, 0o700); err != nil {
		return fmt.Errorf("set secure dir permissions: %w", err)
	}
	return nil
}

func buildUserKeyPaths(storeDir, username string) (keyPair, error) {
	trimmed := strings.TrimSpace(username)
	if trimmed == "" {
		return keyPair{}, errors.New("username is required to store ssh keys")
	}
	if trimmed != filepath.Base(trimmed) || strings.Contains(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return keyPair{}, fmt.Errorf("invalid username for ssh key storage: %q", username)
	}

	userDir := filepath.Join(storeDir, trimmed)
	return keyPair{
		publicKey:  filepath.Join(userDir, "id_ed25519.pub"),
		privateKey: filepath.Join(userDir, "id_ed25519"),
	}, nil
}

func writeSecureFile(path string, content string, mode os.FileMode) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return fmt.Errorf("open secure file: %w", err)
	}
	defer file.Close()

	if _, err := io.WriteString(file, content); err != nil {
		return fmt.Errorf("write secure file: %w", err)
	}

	if err := file.Chmod(mode); err != nil {
		return fmt.Errorf("set secure file permissions: %w", err)
	}

	return nil
}

func fileExists(path string) (bool, error) {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

const (
	privateKeyCipherVersion = "v1"
	privateKeySaltSize      = 16
	privateKeyKeyLen        = 32
	privateKeyArgonTime     = 2
	privateKeyArgonMemory   = 64 * 1024
	privateKeyArgonThreads  = 1
)

func EncryptPrivateKey(password, privateKey string) (string, error) {
	trimmedPassword := strings.TrimSpace(password)
	if trimmedPassword == "" {
		return "", errors.New("password is required to encrypt private key")
	}
	trimmedKey := strings.TrimSpace(privateKey)
	if trimmedKey == "" {
		return "", errors.New("private key is required for encryption")
	}

	salt := make([]byte, privateKeySaltSize)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate private key salt: %w", err)
	}

	key := argon2.IDKey([]byte(trimmedPassword), salt, privateKeyArgonTime, privateKeyArgonMemory, privateKeyArgonThreads, privateKeyKeyLen)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create private key cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create private key gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate private key nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(trimmedKey), nil)

	return fmt.Sprintf("%s:%s:%s:%s",
		privateKeyCipherVersion,
		base64.StdEncoding.EncodeToString(salt),
		base64.StdEncoding.EncodeToString(nonce),
		base64.StdEncoding.EncodeToString(ciphertext),
	), nil
}

func DecryptPrivateKey(password, encryptedPrivateKey string) (string, error) {
	trimmedPassword := strings.TrimSpace(password)
	if trimmedPassword == "" {
		return "", errors.New("password is required to decrypt private key")
	}
	trimmedEncrypted := strings.TrimSpace(encryptedPrivateKey)
	if trimmedEncrypted == "" {
		return "", errors.New("encrypted private key is required")
	}

	parts := strings.Split(trimmedEncrypted, ":")
	if len(parts) != 4 || parts[0] != privateKeyCipherVersion {
		return "", errors.New("invalid encrypted private key format")
	}

	salt, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("invalid encrypted private key salt")
	}
	nonce, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		return "", errors.New("invalid encrypted private key nonce")
	}
	ciphertext, err := base64.StdEncoding.DecodeString(parts[3])
	if err != nil {
		return "", errors.New("invalid encrypted private key data")
	}

	key := argon2.IDKey([]byte(trimmedPassword), salt, privateKeyArgonTime, privateKeyArgonMemory, privateKeyArgonThreads, privateKeyKeyLen)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create private key cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create private key gcm: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("invalid password or corrupted private key")
	}

	return strings.TrimSpace(string(plaintext)), nil
}
