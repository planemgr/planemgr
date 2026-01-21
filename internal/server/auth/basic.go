package auth

import (
	"os"
)

func CredentialsMatch(username, password string) bool {
	return username == os.Getenv("APP_USERNAME") && password == os.Getenv("APP_PASSWORD")
}
