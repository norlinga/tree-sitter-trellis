; Trellis syntax highlighting.
; Captures grow as grammar slices land.

; ---- Comments ----
(comment) @comment

; ---- Block-introducing keywords ----
"Feature:"     @keyword
"Provides:"    @keyword
"Consumes:"    @keyword
"Invariants:"  @keyword
"OutOfScope:"  @keyword
"Scenario"     @keyword

; ---- Step keywords ----
(step_keyword) @keyword.control

; ---- Strings and dates ----
(quoted_string) @string
(iso_date)      @constant.numeric

; ---- Frontmatter keys ----
(frontmatter_key) @attribute

; ---- Scenario kind ----
(scenario_kind) @type

; ---- Identifier paths within handles ----
(identifier_path (identifier) @variable)

; ---- Plain identifiers as variables (frontmatter values, etc.) ----
(identifier) @variable

; ---- Punctuation ----
[":" "," "." "(" ")" "[" "]" "-"] @punctuation.delimiter
