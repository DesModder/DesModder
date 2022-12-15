## Quick reference:

You can have several `*from*`s, but only one `*replace*`.

Patterns (`*from*`):

- `$variable` to match any variable, and capture the name for reuse
- `<range>` to match any balanced sequence of tokens. Must be inside something balanced, such as `{ <range> }`

Replacements (`*replace*`):

- `$variable` to use the earlier captured range
- `<range>` to use the earlier token sequence
