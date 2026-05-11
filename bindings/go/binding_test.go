package tree_sitter_trellis_test

import (
	"testing"

	sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_trellis "github.com/norlinga/tree-sitter-trellis/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	lang := sitter.NewLanguage(tree_sitter_trellis.Language())
	parser := sitter.NewParser()
	defer parser.Close()
	if err := parser.SetLanguage(lang); err != nil {
		t.Fatalf("SetLanguage: %v", err)
	}
}
