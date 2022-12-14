Replacements are now specified using pattern matching with a custom literate-style syntax, rather than complicated Babel expressions.

As an example, suppose you wanted to change a single line in the module `expressions/abstract-item-view` from `this.exitEditListMode()` to `(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())`. This could be represented by

<!-- prettier-ignore -->
````md
# Module `expressions/abstract-item-view`

From:
```js
this.exitEditListMode()
```

To:
```js
(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())
```
````

This is one step above plain string regex: substitutions are done based on tokens, so whitespace does not matter, and you can't accidentally match something inside a string. However, you have to be careful about producing valid code. When in doubt, wrap replacements in parentheses.

## Syntax

The syntax is a subset of Markdown.

The file must start with the string `# Module ` then the module in which to do substitutions, wrapped in backticks.

Each replacement is specified by two code blocks with `js` as their language. The first must be preceded by "From:" and the second by "To:". Any text outside these code blocks has no effect.

The "from" code block is a pattern to search for: all tokens must match exactly, with the exception of identifiers that start with `$`, which can match any identifier and store that value. For example, `$x` could match the identifier `ab`

The "to" code block is what the "from" block gets replaced with. The tokens are substituted exactly, with the exception of identifiers that start with `$`, which use the stored value from the "from" block.
