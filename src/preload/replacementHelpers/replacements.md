Replacements are now specified using pattern matching with a custom literate-style syntax, rather than complicated Babel expressions.

As an example, suppose you wanted to change a single line in the module `expressions/abstract-item-view` from `this.exitEditListMode()` to `(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())`. This could be represented by

<!-- prettier-ignore -->
````md
## Allow pin/unpin without exiting ELM

*Module* `expressions/abstract-item-view`

*From:*
```js
this.exitEditListMode()
```

*To:*
```js
(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())
```
````

This is one step above plain string regex: substitutions are done based on tokens, so whitespace does not matter, and you can't accidentally match something inside a string. However, you have to be careful about producing valid code. When in doubt, wrap replacements in parentheses.

## Syntax

The syntax is a subset of Markdown.

Commands are specified by lines starting with italics like `*from*`. There are currently three commands:

- `*Module*`: starts a module
- `*From*`: gives the "from" pattern. Must be followed by a JS code block.
- `*To*`: gives the "to" replacement. Must be followed by a JS code block.

Currently, the parser is limited and must have chunks of `module, from, to`, in that order.

The "from" code block is a pattern to search for: all tokens must match exactly, with the exception of identifiers that start with `$`, which can match any identifier and store that value. For example, `$x` could match the identifier `ab`

The "to" code block is what the "from" block gets replaced with. The tokens are substituted exactly, with the exception of identifiers that start with `$`, which use the stored value from the "from" block.

## Plans

- Command `*using*`: add a pattern to match but not replace with. Used for finding identifiers
- Command `*inside*`: narrow the search to inside
- Syntax to match balanced strings

These three should be enough to port the rest of the overrides to the new replacements system.
