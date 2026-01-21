package chart

import (
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/filemode"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/google/uuid"
)

var ErrInvalidPath = errors.New("invalid chart file path")
var ErrPathIsDirectory = errors.New("chart path is a directory")

type FileUpdate struct {
	Path    string
	Content string // Full file content
}

func chartWorkdir() string {
	workdir := os.Getenv("WORKDIR")
	if workdir == "" {
		workdir = "./srv"
	}
	return workdir
}

func CreateChartRepo() (string, error) {
	workdir := chartWorkdir()
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return "", err
	}

	for attempts := 0; attempts < 5; attempts++ {
		chartID := uuid.New().String()
		repoPath := filepath.Join(workdir, chartID)
		if _, err := os.Stat(repoPath); err == nil {
			continue
		} else if !errors.Is(err, os.ErrNotExist) {
			return "", err
		}

		if err := initBareRepo(repoPath); err != nil {
			return "", err
		}

		return chartID, nil
	}

	return "", errors.New("unable to allocate chart id")
}

func ListChartRepos() ([]string, error) {
	workdir := chartWorkdir()
	entries, err := os.ReadDir(workdir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, err
	}

	var chartIDs = []string{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		chartIDs = append(chartIDs, entry.Name())
	}

	sort.Strings(chartIDs)
	return chartIDs, nil
}

func ListChartTree(chartID, ref string) (string, []string, error) {
	workdir := chartWorkdir()
	repoPath := filepath.Join(workdir, chartID)
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return "", nil, err
	}

	if ref == "" {
		head, err := repo.Head()
		if err != nil {
			if errors.Is(err, plumbing.ErrReferenceNotFound) {
				return "", []string{}, nil
			}
			return "", nil, err
		}

		ref = head.Hash().String()
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return "", nil, err
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return "", nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return "", nil, err
	}

	files := []string{}
	if err := tree.Files().ForEach(func(file *object.File) error {
		files = append(files, file.Name)
		return nil
	}); err != nil {
		return "", nil, err
	}

	sort.Strings(files)
	return hash.String(), files, nil
}

func ReadChartFile(chartID, path, ref string) (string, string, error) {
	workdir := chartWorkdir()
	repoPath := filepath.Join(workdir, chartID)
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return "", "", err
	}

	if ref == "" {
		head, err := repo.Head()
		if err != nil {
			if errors.Is(err, plumbing.ErrReferenceNotFound) {
				return "", "", plumbing.ErrReferenceNotFound
			}
			return "", "", err
		}

		ref = head.Hash().String()
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return "", "", err
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return "", "", err
	}

	tree, err := commit.Tree()
	if err != nil {
		return "", "", err
	}

	file, err := tree.File(path)
	if err != nil {
		return "", "", err
	}

	contents, err := file.Contents()
	if err != nil {
		return "", "", err
	}

	return hash.String(), contents, nil
}

func WriteChartFiles(chartID string, updates []FileUpdate, message string) (string, error) {
	if len(updates) == 0 {
		return "", ErrInvalidPath
	}

	workdir := chartWorkdir()
	repoPath := filepath.Join(workdir, chartID)
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return "", err
	}

	branchName := plumbing.NewBranchReferenceName("main")
	headRef, err := repo.Head()
	if err != nil && !errors.Is(err, plumbing.ErrReferenceNotFound) {
		return "", err
	}
	if err == nil {
		if headRef.Type() == plumbing.SymbolicReference {
			branchName = headRef.Target()
		} else if headRef.Name() != plumbing.HEAD {
			branchName = headRef.Name()
		}
	}

	var (
		baseTree   *object.Tree
		parentHash plumbing.Hash
	)
	ref, err := repo.Reference(branchName, true)
	if err != nil && !errors.Is(err, plumbing.ErrReferenceNotFound) {
		return "", err
	}
	if err == nil && !ref.Hash().IsZero() {
		parentHash = ref.Hash()
		parentCommit, err := repo.CommitObject(parentHash)
		if err != nil {
			return "", err
		}
		baseTree, err = parentCommit.Tree()
		if err != nil {
			return "", err
		}
	}
	if baseTree == nil {
		baseTree = &object.Tree{}
	}

	seen := make(map[string]struct{}, len(updates))
	var treeHash plumbing.Hash
	for _, update := range updates {
		cleanPath, err := cleanChartPath(update.Path)
		if err != nil {
			return "", err
		}
		if _, exists := seen[cleanPath]; exists {
			return "", ErrInvalidPath
		}
		seen[cleanPath] = struct{}{}

		blobHash, err := writeBlob(repo, update.Content)
		if err != nil {
			return "", err
		}

		treeHash, err = writeTree(repo, baseTree, strings.Split(cleanPath, "/"), blobHash)
		if err != nil {
			return "", err
		}

		baseTree, err = object.GetTree(repo.Storer, treeHash)
		if err != nil {
			return "", err
		}
	}

	commit := &object.Commit{
		TreeHash: treeHash,
		Author: object.Signature{
			Name:  "planemgr",
			Email: "noreply@planemgr.local",
			When:  time.Now(),
		},
		Committer: object.Signature{
			Name:  "planemgr",
			Email: "noreply@planemgr.local",
			When:  time.Now(),
		},
		Message: message,
	}
	if !parentHash.IsZero() {
		commit.ParentHashes = []plumbing.Hash{parentHash}
	}

	obj := repo.Storer.NewEncodedObject()
	if err := commit.Encode(obj); err != nil {
		return "", err
	}

	commitHash, err := repo.Storer.SetEncodedObject(obj)
	if err != nil {
		return "", err
	}

	newRef := plumbing.NewHashReference(branchName, commitHash)
	if err := repo.Storer.SetReference(newRef); err != nil {
		return "", err
	}

	return commitHash.String(), nil
}

func initBareRepo(path string) error {
	repo, err := git.PlainInit(path, true)
	if err != nil {
		return err
	}

	head := plumbing.NewSymbolicReference(plumbing.HEAD, plumbing.NewBranchReferenceName("main"))
	return repo.Storer.SetReference(head)
}

func cleanChartPath(filePath string) (string, error) {
	if filePath == "" {
		return "", ErrInvalidPath
	}
	if path.IsAbs(filePath) {
		return "", ErrInvalidPath
	}

	cleanPath := path.Clean(filePath)
	if cleanPath == "." || cleanPath == "/" || strings.HasPrefix(cleanPath, "../") || cleanPath == ".." {
		return "", ErrInvalidPath
	}

	return cleanPath, nil
}

func writeBlob(repo *git.Repository, contents string) (plumbing.Hash, error) {
	obj := repo.Storer.NewEncodedObject()
	obj.SetType(plumbing.BlobObject)

	writer, err := obj.Writer()
	if err != nil {
		return plumbing.ZeroHash, err
	}
	if _, err := io.WriteString(writer, contents); err != nil {
		_ = writer.Close()
		return plumbing.ZeroHash, err
	}
	if err := writer.Close(); err != nil {
		return plumbing.ZeroHash, err
	}

	return repo.Storer.SetEncodedObject(obj)
}

func writeTree(repo *git.Repository, tree *object.Tree, parts []string, blobHash plumbing.Hash) (plumbing.Hash, error) {
	if len(parts) == 0 {
		return plumbing.ZeroHash, ErrInvalidPath
	}

	name := parts[0]
	entries := make([]object.TreeEntry, 0, len(tree.Entries)+1)
	var existing *object.TreeEntry
	for i := range tree.Entries {
		entry := tree.Entries[i]
		if entry.Name == name {
			existing = &entry
			continue
		}
		entries = append(entries, entry)
	}

	if len(parts) == 1 {
		if existing != nil && existing.Mode == filemode.Dir {
			return plumbing.ZeroHash, ErrPathIsDirectory
		}
		entries = append(entries, object.TreeEntry{
			Name: name,
			Mode: filemode.Regular,
			Hash: blobHash,
		})
	} else {
		var nextTree *object.Tree
		if existing != nil {
			if existing.Mode != filemode.Dir {
				return plumbing.ZeroHash, ErrPathIsDirectory
			}
			childTree, err := object.GetTree(repo.Storer, existing.Hash)
			if err != nil {
				return plumbing.ZeroHash, err
			}
			nextTree = childTree
		} else {
			nextTree = &object.Tree{}
		}

		childHash, err := writeTree(repo, nextTree, parts[1:], blobHash)
		if err != nil {
			return plumbing.ZeroHash, err
		}

		entries = append(entries, object.TreeEntry{
			Name: name,
			Mode: filemode.Dir,
			Hash: childHash,
		})
	}

	sort.Sort(object.TreeEntrySorter(entries))
	newTree := &object.Tree{Entries: entries}
	obj := repo.Storer.NewEncodedObject()
	if err := newTree.Encode(obj); err != nil {
		return plumbing.ZeroHash, err
	}

	return repo.Storer.SetEncodedObject(obj)
}
