# Text Mode Introduction

Text Mode is a way to edit Desmos graphs using plaintext (code) instead of the vanilla approach which uses MathQuill (fancy math formatting) and UI menus.

The easiest way to get started with Text Mode (once you have DesModder installed) is by switching to text mode on an existing graph.

- Switch to Text Mode using the <kbd>T</kbd> button at the top of the expressions list, to the right of the undo/redo buttons.
- If you don't see the <kbd>T</kbd> button, make sure the Text Mode plugin is enabled in the DesModder plugins list

For example, the graph at <https://www.desmos.com/calculator/jioybtjgo7> becomes

```js
settings @{
  randomSeed: "ba9f5c1341fffbc57ac9c50540018465",
  viewport: @{ xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
}

y = (1 / (4 * p)) * x ^ 2 @{
  color: "#c74440",
  lines: @{ opacity: 0.9, width: 2.5, style: "SOLID" },
}

p = 3 @{ color: "#2d70b3", slider: @{ min: 0.1, max: 20, step: 0 } }

(0, p) @{
  color: "#c74440",
  points: @{ opacity: 0.9, size: 9, style: "POINT", drag: "AUTO" },
}
```

## Text Mode Pros and Cons

Pros:

- line wrapping
- easy copy-paste
- easy multi-character names
- (WIP) more features, such as nested folders, local scoping, and structs

Cons:

- less intuitive notation (e.g. no fractions, just inline division)
- options are not clearly laid out by a UI
- variety of bugs (WIP fixes)
- worse performance while editing (WIP performance improvements)

## Learn the Language

If you want a more guided tutorial than playing around with converting graphs to Text Mode, check out the following links:

- [Expressions](./expressions.md)
- [Style Mappings](./style-mappings.md)
- [Statements](./statements.md)
- [Tables](./tables.md)
- [Images](./images.md)
- [Text](./text.md)
- [Folders](./folders.md)
- [Settings](./settings.md)
- [Tickers](./tickers.md)

## Hotkeys

### Accessibility

- <kbd>Escape</kbd>, then <kbd>Tab</kbd>: focus the element after the editor ("Graph settings" menu)
- <kbd>Escape</kbd>, then <kbd>Shift</kbd>+<kbd>Tab</kbd>: focus the element before the editor ("Hide Expressions List" button)
- <kbd>Esc</kbd>: exit menus

### Tools

- <kbd>Ctrl</kbd>+<kbd>Space</kbd>: show completions (arrows to move, <kbd>enter</kbd> to accept)
- <kbd>Tab</kbd> or <kbd>Ctrl</kbd>+<kbd>]</kbd>: indent
- <kbd>Shift</kbd>+<kbd>Tab</kbd> or <kbd>Ctrl</kbd>+<kbd>[</kbd>: dedent (un-indent)
- <kbd>Ctrl</kbd>+<kbd>F</kbd>: search
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd>: fold selected structure
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>]</kbd>: unfold
- <kbd>Ctrl</kbd>+click: add cursor

## Notable Bugs

- The existing undo and redo buttons do not edit text code
  - for now, avoid using the undo and redo buttons or corresponding hotkey
- An object with 0 fill opacity gets set to have fill disabled
  - if you want an invisible button, set opacity to a small number like 0.0000001
