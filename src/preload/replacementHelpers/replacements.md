## Quick reference:

## Command syntax

Calling a command looks like:

- (general form) `` *command* `arg1` `arg2` => `return_value` ``
- (no args) `` *command* => `return_value` ``
- (return value not captured) `` *command* `arg1` `arg2` ``

Any text outside of `` `backticks` `` or `*asterisks*` are ignored, except the return separator `=>`.

Arguments are passed by value. There is only one data type, a range in the code. For example, `` *Find* `template` `` passes the range value of `template` to the `*Find*` command. So `*Find*` might receive a range like `{start: 400, length: 200}` as argument.

Some commands require a pattern as an extra argument (a second data type? ok I lied). A pattern is passed as a code block like

<!-- prettier-ignore -->
````md
*Find*

```js
.getSections = function () {__body__}
```
````

Then the pattern argument to `*Find*` is the sequence of tokens `[".", "getSections", "=", "function", "(", ")", "{", "__body__", "}"]`, (and some whitespace). You generally don't have to think about tokens when writing replacements. Just treat it as code that is looked for, but quirks end up being ignored, such as whitespace and double-quoted vs single-quoted strings.

## Builtin commands

There are only two builtin commands:

### `*Find*`

`*Find*` takes zero or one range arguments, and one pattern argument. The command searches for substrings of the code matching that pattern. If one range argument is passed, the search is narrowed to that range.

#### Examples

<!-- prettier-ignore -->
````md
*Find* => `call`

```js
this.controller.isExpressionListFocused()
```
````

Finds the code `this.controller.isExpressionListFocused()`, and lets the variable `call` represent that range value

<!-- prettier-ignore -->
````md
*Find* inside `narrow` => `call`

```js
this.controller.isExpressionListFocused()
```
````

Is the same as the previous example, but only looks in the range given by `narrow`, not the whole module file.

#### Special Patterns

Some special pattern tokens match something other than their exact value:

- `$id` matches any identifier name, and lets the variable `id` represent that identifier name.
- `$` matches any identifier name but ignores the value
- `__range__` matches a balanced sequence of tokens, and lets `range` represent that range of tokens
  - Greedy, matches up to the next close brace
  - Must be followed by a close brace in the pattern
- `____` matches a balanced sequence of code but ignores the value

The patterns bind names (`id` and `range`) in these bulleted examples. They get placed into the scope of the block in which the pattern appears; they do not get returned as return values. What this means is these carry over to later patterns in the same block.

#### Special Pattern Examples

<!-- prettier-ignore -->
````md
*Find* => `from`

```js
if ($List.getMissingVariablesForItem($l).length && $e.areSlidersEnabled())
  return $e.createSlidersForItem(
```
````

Finds a chunk of code, but allows for the variable names changing on the next minified recompile. The two references to `$e` must be the same variable name.

<!-- prettier-ignore -->
````md
*Find* inside `template`

```js
return $DCGView.createElement(
  'div',
  { class: $DCGView.const('dcg-options-menu-content') },
  __rest__
)
```
````

Note that the return value is not specified (there is no `` => `name`  ``). The point of this code block is to find what the `__rest__` pattern matches.

### `*Replace*`

`*Replace*` takes one range arguments, and one pattern argument. The command replaces the range with the pattern. This must be the last command in a Module block, and it cannot occur elsewhere.

Special patterns from `*Find*` can also be used in `*Replace*`, where they do a direct substitution of the token lists.

#### Examples

<!-- prettier-ignore -->
````md
*Find* => `from`
```js
this.controller.isExpressionListFocused()
```

*Replace* `from` with
```js
!window.DesModder?.controller?.inTextMode?.()
```
````

Simple direct text replacement.

<!-- prettier-ignore -->
````md
*Find* => `from`
```js
var $r = $e.hasClass('dcg-all')
```

*Replace* `from` with
```js
if ($e.hasClass("dsm-hide-errors")) {
  DesModder.controller?.hideError(this.model.id)
  return;
}
var $r = $e.hasClass('dcg-all')
```
````

Demonstrates the variables carrying over: the value of `e` is used in the `*Replace*` after being found in the `*Find*`.

## Blocks

A block is the basic unit of a replacement. A block starts at a block-starter command. The block-starter command must be immediately after a heading. The block continues until the next heading of equal or shallower depth (fewer `#`s).

The one block-starter command are `*Module*`

### `*Module*`

`*Module*` takes at least one argument, the module names to apply this block's replacements to. Example usage:

<!-- prettier-ignore -->
```md
_Module_ `main/calc_desktop`
```
