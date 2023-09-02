# Text Mode Editor

This module is currently still quite entangled with [DesModder](https://github.com/DesModder/DesModder/), so the API is terrible and very much subject to change.

Here's what you probably want to use for now, assuming a global Desmos API instance `Desmos`:

```ts
const graphContainer = document.getElementById("graph-container");
const Calc = Desmos.GraphingCalculator(graphContainer);

// The text-mode-editor API still requires "Desmos" to be a global variable
const textModeContainer = document.getElementById("text-mode-container");
const editor = new TextModeEditor(Calc);
editor.mount(textModeContainer);
```
