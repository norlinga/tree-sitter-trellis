# tree-sitter-trellis

A tree-sitter grammar for the [Trellis](https://github.com/norlinga/trellis)
sidecar specification format (`.trellis` files).

This grammar is the **normative** definition of valid Trellis syntax: the
prose spec, the linter, the LSP, and any third-party consumer all defer to
what `grammar.js` accepts. If the grammar and the prose disagree, the grammar
wins.

For the format itself — what `.trellis` files are, why they exist, and how to
author them — see the main [trellis](https://github.com/norlinga/trellis)
repository (`spec/format.md` is the authoring guide).

---

## Status

v0.1 — grammar slices 1, 2, 3, and 5 shipped; all **41 corpus tests pass**.

Slice 4 (sub-tokenization of step text — splitting `Given a User with a
'valid' stripe_token` into typed sub-nodes) is intentionally deferred to the
linter, which scans for RFC 2119 keywords and single-quoted literals in step
prose without grammar support. The grammar treats step text as a single
opaque run.

| Slice | Description | Status |
|---|---|---|
| 1 | Frontmatter + `Feature:` header | ✅ |
| 2 | Context blocks (`Provides:` / `Consumes:` / `Invariants:` / `OutOfScope:`) | ✅ |
| 3 | `Scenario` blocks with kind, name, and steps | ✅ |
| 4 | Step-text sub-tokenization | Deferred to linter (intentional) |
| 5 | Comments (line-leading `#`) | ✅ |

**Bindings enabled** (per `tree-sitter.json`):

| Binding | Status |
|---|---|
| Go (`bindings/go/`) | ✅ enabled and tested |
| C / Node / Python / Rust / Swift / Zig | Not enabled in v0.1 |

Generating additional bindings is a `tree-sitter generate` flag flip plus
binding-specific scaffolding — open an issue if you need one.

---

## Using the grammar

### As a tree-sitter grammar in your editor

The grammar is not yet published to the `nvim-treesitter` parser registry.
Until it is, point the parser at this repository directly.

**Neovim** (with `nvim-treesitter`):

```lua
local parser_config = require("nvim-treesitter.parsers").get_parser_configs()
parser_config.trellis = {
  install_info = {
    url = "https://github.com/norlinga/tree-sitter-trellis",
    files = { "src/parser.c" },
    branch = "main",
  },
  filetype = "trellis",
}
-- :TSInstall trellis
```

`queries/highlights.scm` is bundled in the grammar repository and will be
picked up automatically.

**Helix, Zed, and other tree-sitter consumers**: point them at this
repository, the grammar name `trellis`, and the highlight query at
`queries/highlights.scm`. Each editor has its own configuration shape;
upstreaming to their parser registries is in progress.

### As a Go library

The grammar exposes a `tree_sitter_trellis.Language()` constructor consumable
by `github.com/tree-sitter/go-tree-sitter` v0.25.x. Used directly by the
[trellis](https://github.com/norlinga/trellis) toolchain — see
`internal/parser/parser.go` there for a worked example.

```sh
go get github.com/norlinga/tree-sitter-trellis@latest
```

```go
package main

import (
    "fmt"

    sitter "github.com/tree-sitter/go-tree-sitter"
    tree_sitter_trellis "github.com/norlinga/tree-sitter-trellis/bindings/go"
)

func main() {
    parser := sitter.NewParser()
    defer parser.Close()
    if err := parser.SetLanguage(sitter.NewLanguage(tree_sitter_trellis.Language())); err != nil {
        panic(err)
    }
    src := []byte("@owner: me\n\nFeature: Hello\n  \"A summary.\"\n")
    tree := parser.Parse(src, nil)
    defer tree.Close()
    fmt.Println(tree.RootNode().ToSexp())
}
```

### Parsing one file from the CLI

```sh
tree-sitter parse path/to/sidecar.rb.trellis
```

Requires the `tree-sitter` CLI (0.26.x or compatible). For a smoke test
against the bundled example:

```sh
tree-sitter parse examples/create_subscription.rb.trellis
```

---

## Building from source

Requires:

- `tree-sitter` CLI 0.26.x
- A C compiler (the generated `src/parser.c` is plain C99)
- Go 1.23+ (only if exercising the Go bindings)

```sh
git clone https://github.com/norlinga/tree-sitter-trellis.git
cd tree-sitter-trellis
tree-sitter generate          # regenerate src/parser.c from grammar.js
tree-sitter test              # 41/41 corpus fixtures should pass
go test ./...                 # exercises the Go bindings
```

`src/parser.c` and the rest of the generated parser are committed so that
consumers don't need the `tree-sitter` CLI installed to build the bindings.
Regenerate after every grammar change.

---

## Repository layout

```
grammar.js              # the normative grammar (annotated; comments link to design decisions)
tree-sitter.json        # grammar manifest: scope, file-types, highlights path, enabled bindings
package.json            # tree-sitter CLI dependency
src/                    # generated C parser (committed)
  parser.c
  grammar.json
  node-types.json
  tree_sitter/
queries/
  highlights.scm        # editor syntax-highlighting queries
test/
  README.md             # rules for adding corpus fixtures
  corpus/               # tree-sitter-test-format fixtures, one file per slice
bindings/
  go/                   # Go bindings entry point + smoke test
examples/               # representative whole-file sidecars (one per supported language idiom)
```

---

## Design decisions

Every non-obvious construct in `grammar.js` is annotated with a
comment that explains the reason for the shape. The annotations are the
canonical reference for *why* — read them when something looks odd.

The prose-level spec for the format (file pairing, the Consumes Discipline,
authoring conventions, override mechanism) lives in the main
[trellis](https://github.com/norlinga/trellis) repository at
`spec/format.md`.

---

## Source anchors (`@source`)

A `Provides:` or `Consumes:` entry may carry an optional `@source("…")`
annotation between its handle and its description:

```trellis
Provides:
  - Billing.Proration.calculate @source("symbol:CalculateProration") -> Money
  - Event: subscription.created @source("symbol:SubscriptionCreated")

Consumes:
  - PaymentGateway.charge @source("line:42-68") -> ChargeResult
```

The annotation is permitted **wherever a handle appears** — both block kinds,
both handle shapes (`path` and `prefixed`), with or without a trailing
description. Handles only exist in `Provides:` and `Consumes:` entries, so that
is the full extent of where `@source` is valid; `Invariants:` and `OutOfScope:`
are prose and take no anchor.

This uniform availability is a **consistency and simplicity** decision, not a
semantic one. The anchor hangs off the shared entry rule, so the same syntax
works everywhere a handle does rather than being special-cased per block.

The grammar assigns the annotation **no meaning**. `source_anchor` is parsed as
an opaque double-quoted payload (`symbol:…`, `line:…`, or anything else a
language ecosystem chooses); tree-sitter never interprets it. The handle remains
the sole graph identity — `@source` is purely adjacent location metadata.

Consequently, **whether anything acts on these annotations is up to the
consumer.** Trellis core, the linter, the LSP, and any AI agent tooling may or
may not read them; this grammar only guarantees they parse into a stable node.
Authoring `@source` is therefore safe and lossless even against tools that
ignore it entirely.

---

## Contributing

The grammar and its corpus tests evolve together. Two rules:

1. **Bug-reproducer first.** If a real-world `.trellis` file from any
   consuming repo surfaces a parser bug, add a minimal reproducer to
   `test/corpus/` *before* fixing it. The fixture is the regression test.
2. **`tree-sitter test` must pass before any commit.** All 41 corpus
   fixtures (or however many exist when you read this) green — no
   exceptions for "I'm just iterating."

Other norms:

- **Realistic, semantically-loaded `.trellis` files do not belong here.**
  The fixtures here exercise the grammar; consumer-oriented test data lives
  in the [trellis](https://github.com/norlinga/trellis) repo's `testdata/`.
- **Regenerate `src/parser.c`** after any change to `grammar.js`. Commit
  both files in the same change.
- **Highlight queries** evolve as new node types appear. Adding a node
  generally means adding a capture in `queries/highlights.scm` and
  surfacing it in downstream editor extensions.

---

## License

MIT. See `LICENSE`.
