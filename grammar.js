/**
 * Tree-sitter grammar for the Trellis sidecar specification format.
 *
 * Source of truth for syntax. Design rationale lives in the planning repo's
 * TREE_SITTER_DECISIONS.md.
 *
 * Implementation slices (see README):
 *   Slice 1: frontmatter + Feature header                  ← done
 *   Slice 2: Context blocks (Provides/Consumes/...)        ← current
 *   Slice 3: Scenario blocks
 *   Slice 4: Step content (literals, RFC 2119 keywords)
 *   Slice 5: Comments
 *
 * Newline policy (decision #4):
 *   Trellis is line-oriented. Horizontal whitespace is in `extras`
 *   (insignificant); newlines are structural tokens. Each line-construct
 *   greedily consumes its trailing blank lines via `_blank_lines`
 *   (= `repeat1('\n')`). The next construct does NOT consume a leading
 *   separator — the boundary is already established by the previous line's
 *   trailing newlines.
 */

module.exports = grammar({
  name: 'trellis',

  extras: $ => [
    /[ \t]+/,
    $.comment,
  ],

  // Treat `identifier` as the canonical "word" so literal keywords only
  // match at word boundaries. Without this, `Given` would false-match the
  // start of `Givenchy`, `When` would false-match `Whenever`, etc.
  // (decision #4 — step keywords recognized only as whole words).
  word: $ => $.identifier,

  conflicts: $ => [
    // After a Feature's summary, a `\n` could either start the optional
    // sequence of context blocks (extending the feature) or be consumed
    // by source_file's trailing blank lines (ending the feature). GLR
    // picks based on whether a context-block keyword follows.
    [$.feature],

    // Same boundary ambiguity at the end of each context block: a `\n`
    // could keep extending the current block's trailing _blank_lines, or
    // end the block so the next context block (or source_file) consumes
    // the newline. GLR picks based on what comes after the newlines.
    // Tree-sitter reports only one of each entry-type-sharing pair as
    // necessary; the other is implicit.
    [$.provides_block],
    [$.invariants_block],
    [$.scenario_block],
  ],

  rules: {

    // A .trellis file is exactly one Feature, optionally preceded by a
    // frontmatter block. Zero or two-plus Features is a parse error
    // (decision #9).
    source_file: $ => seq(
      optional($._blank_lines),
      optional(field('frontmatter', $.frontmatter)),
      field('feature', $.feature),
      optional($._blank_lines),
    ),

    // ===============================================================
    // Frontmatter (decisions #5, #5a)
    // ===============================================================

    frontmatter: $ => repeat1(seq(
      $.frontmatter_entry,
      $._blank_lines,
    )),

    frontmatter_entry: $ => seq(
      field('key', $.frontmatter_key),
      ':',
      field('value', $._frontmatter_value),
    ),

    frontmatter_key: $ => /@[A-Za-z][A-Za-z0-9_-]*/,

    _frontmatter_value: $ => choice(
      $.iso_date,
      $.identifier,
      $.quoted_string,
      $.list,
    ),

    // ===============================================================
    // Feature
    // ===============================================================

    feature: $ => seq(
      'Feature:',
      field('name', $.feature_name),
      optional($._blank_lines),
      field('summary', $.quoted_string),
      optional(seq(
        $._blank_lines,
        repeat($._context_block),
        repeat($.scenario_block),
      )),
    ),

    // Free text on the Feature: line, terminating at newline or at the
    // opening quote of the summary (which permits `Feature: Name "summary"`
    // on a single line). Trailing whitespace inside the match is normalized
    // by lint.
    feature_name: $ => /[^\n"]+/,

    // ===============================================================
    // Context blocks (decision #6)
    //
    // Four block kinds. Each block's last entry consumes trailing blank
    // lines, so the next block (if any) starts immediately at its keyword.
    // ===============================================================

    _context_block: $ => choice(
      $.provides_block,
      $.consumes_block,
      $.invariants_block,
      $.out_of_scope_block,
    ),

    provides_block: $ => seq(
      'Provides:',
      $._blank_lines,
      repeat1(seq($.handle_entry, $._blank_lines)),
    ),

    consumes_block: $ => seq(
      'Consumes:',
      $._blank_lines,
      repeat1(seq($.handle_entry, $._blank_lines)),
    ),

    invariants_block: $ => seq(
      'Invariants:',
      $._blank_lines,
      repeat1(seq($.prose_entry, $._blank_lines)),
    ),

    out_of_scope_block: $ => seq(
      'OutOfScope:',
      $._blank_lines,
      repeat1(seq($.prose_entry, $._blank_lines)),
    ),

    // ----- Entries with handle/description split (Provides, Consumes) -----
    //
    // Hybrid form per decision #6: each entry has a structured handle for
    // graph matching and an opaque description for human reading.

    handle_entry: $ => seq(
      '-',
      field('handle', $._handle),
      field('source_anchor', optional($.source_anchor)),
      field('description', optional($.entry_description)),
    ),

    _handle: $ => choice(
      $.prefixed_handle,
      $.path_handle,
    ),

    // `Event: subscription.created` → prefix=Event, path=subscription.created.
    // The colon is the disambiguator from the path form.
    prefixed_handle: $ => seq(
      field('prefix', $.identifier),
      ':',
      field('path', $.identifier_path),
    ),

    path_handle: $ => $.identifier_path,

    identifier_path: $ => seq(
      $.identifier,
      repeat(seq('.', $.identifier)),
    ),

    // Optional implementation locator for a provided/consumed contract.
    // This is deliberately separate from the handle token: the handle remains
    // graph identity, while source_anchor is opaque location metadata for
    // tooling such as `trellis locate`.
    //
    // Examples:
    //   - Billing.Proration.calculate @source("symbol:Calculate")
    //   - Legacy.Batch.close @source("line:42-68") -> Result
    //
    // The quoted payload is generic so different language ecosystems can
    // choose anchors without expanding the handle grammar. It is interpreted
    // by Trellis core, not by tree-sitter.
    source_anchor: $ => seq(
      '@source',
      '(',
      field('value', $.quoted_string),
      ')',
    ),

    // Everything after the handle, to end of line. Captured verbatim;
    // never interpreted by the graph. Slice 4 will restructure this to
    // recognize embedded literals and RFC 2119 markers.
    //
    // Negative token precedence keeps the lexer's longest-match rule from
    // grabbing identifier-path continuations (e.g. `.create`) as
    // description before the parser can extend the path.
    entry_description: $ => token(prec(-1, /[^\n]+/)),

    // ----- Entries that are pure prose (Invariants, OutOfScope) -----

    prose_entry: $ => seq(
      '-',
      field('text', $.prose_text),
    ),

    // Slice 4 deferred: tokenizing literals and RFC 2119 markers inside
    // prose requires context-sensitive lexing that tree-sitter's static
    // precedence cannot express without an external scanner. Kept as an
    // opaque text token for now; literal/RFC 2119 detection moves to the
    // linter (which can scan source ranges directly).
    prose_text: $ => token(prec(-1, /[^\n]+/)),

    // ===============================================================
    // Scenario blocks (decision #8)
    //
    // Grammar accepts any kebab-case identifier as the kind. The linter
    // enforces the canonical set with alias-suggestion diagnostics.
    // ===============================================================

    scenario_block: $ => seq(
      'Scenario',
      optional(seq('(', field('kind', $.scenario_kind), ')')),
      ':',
      field('name', $.scenario_name),
      $._blank_lines,
      repeat1(seq($.step, $._blank_lines)),
    ),

    // Kebab-case identifier: lowercase letter-led, lowercase letters,
    // digits, hyphens. Empty parens (`Scenario ():`) is a parse error
    // because the production requires at least one character.
    scenario_kind: $ => /[a-z][a-z0-9-]*/,

    // Free text on the Scenario line, terminating at newline.
    scenario_name: $ => token(prec(-1, /[^\n]+/)),

    step: $ => seq(
      field('keyword', $.step_keyword),
      field('text', $.step_text),
    ),

    // The five Gherkin step keywords. The grammar's `word` rule ensures
    // these only match as whole words at the start of a step position.
    step_keyword: $ => choice('Given', 'When', 'Then', 'And', 'But'),

    // Slice 4 deferred: see prose_text comment above. step_text is an
    // opaque text token; literal/RFC 2119 sub-tokenization will require
    // an external scanner to do correctly (the lexer issue is documented
    // in TREE_SITTER_DECISIONS.md §slice-4).
    step_text: $ => token(prec(-1, /[^\n]+/)),

    // ===============================================================
    // Atomic value productions (shared)
    // ===============================================================

    identifier: $ => /[A-Za-z][A-Za-z0-9_-]*/,

    iso_date: $ => /\d{4}-\d{2}-\d{2}/,

    // Double-quoted string. No escapes in v1. Cannot span newlines.
    quoted_string: $ => /"[^"\n]*"/,

    list: $ => seq(
      '[',
      optional(seq(
        $.identifier,
        repeat(seq(',', $.identifier)),
        optional(','),
      )),
      ']',
    ),

    // ===============================================================
    // Comments (decision #10)
    //
    // Line-leading `#` to end of line. Declared as an `extras` token so
    // comments are valid at any position in the AST (between any two
    // structural tokens). Mid-line `#` stays as prose because rest-of-line
    // tokens (step_text, prose_text, entry_description) greedily consume
    // their lines before the lexer gets a chance to consider extras —
    // this gives us the line-leading-only behavior decision #10 specifies
    // without needing an external scanner to enforce it.
    //
    // Visible in the AST so editors can query and highlight comments.
    // ===============================================================

    comment: $ => token(/#[^\n]*/),

    // ===============================================================
    // Whitespace plumbing
    // ===============================================================

    // One or more newline tokens. Used as line terminator and blank-line
    // absorber. Greedy by virtue of repeat1.
    _blank_lines: $ => repeat1('\n'),

  },
});
