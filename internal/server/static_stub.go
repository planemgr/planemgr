//go:build !embedfs

package server

import "io/fs"

func staticFS() (fs.FS, bool) {
	return nil, false
}
