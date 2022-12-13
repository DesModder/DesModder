Replacements are now specified using pattern matching with a custom syntax, rather than complicated Babel expressions.

As an example, suppose you wanted to change a single line in the module `expressions/abstract-item-view` from `this.exitEditListMode()` to `(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())`. This could be represented by

<!-- prettier-ignore -->
```js
// in module "expressions/abstract-item-view"
// replace {
this.exitEditListMode()
// } with {
(event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())
// }
```

This is one step above plain string regex: substitutions are done based on tokens, so whitespace does not matter, and you can't accidentally match something inside a string. However, you have to be careful about producing valid code. When in doubt, wrap replacements in parentheses.
