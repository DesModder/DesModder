## Quick reference:

Command list:

- `` *plugin* `plugin-name`  ``: required at the top, after the top heading. Only one allowed
- `` *module* `module-name`  ``: starts a new replacement. Only one allowed per replacement. Must be immediately after a heading, and the replacement continues until the next heading of equal or shallower depth (fewer `#`s)
- `` *find* `captured_name` (code block pattern) ``: find the pattern, and bind its range to `captured_name`
- `` *find_inside* `captured_name` inside `inside_range` (code block pattern) ``: find the pattern inside the range `inside_range`, and bind its range to `captured_name`
- `` *replace* `from` (code block) ``: replace the range in `from` with the code block. Only one allowed per replacement

For `*find*` and `*find_inside*`, if the `` `captured_name` `` is blank, then duplicates are allowed. E.g. if you watch to find the `Tooltip` import, you might match `.createElement($Tooltip.Tooltip`. If this appears several times, then blank the captured name; otherwise you get an error.

## Syntax inside

Patterns (`*find*` and `*find_inside*`):

- `$variable` to match any variable, and capture the name for reuse
- `__range__` to match any balanced sequence of tokens. Greedy, matches up to the next close brace

Replacements (`*replace*`):

- `$variable` to use the earlier captured range
- `__range__` to use the earlier token sequence