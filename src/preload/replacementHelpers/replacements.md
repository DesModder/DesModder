## Quick reference:

Command list:

- `` *plugin* `plugin-name`  ``: required at the top, after the top heading. Only one allowed
- `` *module* `module-name`  ``: starts a new replacement. Only one allowed per replacement. Must be immediately after a heading, and the replacement continues until the next heading of equal or shallower depth (fewer `#`s)
- `` *find* `captured_name` (code block pattern) ``: find the pattern, and bind its range to `captured_name`
- `` *find_inside* `captured_name` inside `inside_range` (code block pattern) ``: find the pattern inside the range `inside_range`, and bind its range to `captured_name`
- `` *replace* `from` (code block) ``: replace the range in `from` with the code block. Only one allowed per replacement

## Syntax inside

Patterns (`*from*`):

- `$variable` to match any variable, and capture the name for reuse
- `<range>` to match any balanced sequence of tokens. Must be inside something balanced, such as `{ <range> }`
- `__range__` is similar to `<range>` but can't have whitespace after it. The advantage of `__range__` is syntax highlighting works better. Currently a pain point; I'd like to change this

Replacements (`*replace*`):

- `$variable` to use the earlier captured range
- `<range>` to use the earlier token sequence
- `__range__` is similar to `<range>`
