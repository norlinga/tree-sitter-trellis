# Fixture Corpus

This directory holds **grammar-exercising** fixtures in tree-sitter test format.

Each `.txt` file contains one or more test cases of the form:

```
==================
Name of test
==================

<input source>

---

(expected_root_node
  (child_node)
  ...)
```

Run with `tree-sitter test` from the repo root.

## What goes here

Fixtures here test that the **grammar** parses inputs into the expected tree shape. They are typically small, syntactically reduced, and named for the rule they exercise.

Realistic, semantically-loaded `.trellis` files for linter and graph testing live in the [`trellis`](https://github.com/norlinga/trellis) repo's `testdata/` directory. They are deliberately separate (see decision #2 in the planning repo).

## Bug-reproducer rule

If a real-world `.trellis` file from any consuming repo (linter, graph CLI, LSP, agent skill) surfaces a parser bug, **add a minimal reproducer here before fixing**. This is the only enforced bridge between this corpus and the integration fixture sets elsewhere — without it, the parser corpus drifts behind real usage.

The reproducer should:

- Reduce the failing input to the smallest example that still fails.
- Live in a corpus file named for the failing construct (or a new one if none fits).
- Include the expected (correct) parse tree, not the buggy one.
