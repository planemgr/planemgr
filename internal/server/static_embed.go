//go:build embedfs

package server

import (
	"embed"
	"io/fs"
)

//go:embed all:static
var embeddedStatic embed.FS

func staticFS() (fs.FS, bool) {
	sub, err := fs.Sub(embeddedStatic, "static")
	if err != nil {
		return nil, false
	}
	return sub, true
}
