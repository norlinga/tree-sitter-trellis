package tree_sitter_trellis

// #cgo CFLAGS: -std=c11 -fPIC -I${SRCDIR}/../../src
// #include "../../src/parser.c"
import "C"

import "unsafe"

// Language returns an unsafe.Pointer to the TSLanguage produced by the
// generated parser. Callers wrap with tree_sitter.NewLanguage(...).
func Language() unsafe.Pointer {
	return unsafe.Pointer(C.tree_sitter_trellis())
}
