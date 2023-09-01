# Text Mode Editor

This module is currently still quite entangled with [DesModder](https://github.com/DesModder/DesModder/), so the API is terrible and very much subject to change.

Here's what you probably want to use for now, assuming a global Desmos API instance `Desmos` and calculator `Calc`:

```ts
const graphContainer = document.getElementById("graph-container");
const Calc = Desmos.GraphingCalculator(graphContainer);

// Yes, the API currently relies on a global variable named "Calc"
// and a global variable named "Desmos". Terrible.
window.Calc = Calc;
const textModeContainer = document.getElementById("text-mode-container");
const editor = new TextModeEditor();
editor.mount(textModeContainer);
```
