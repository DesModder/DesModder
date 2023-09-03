# Text Mode Editor

This package is designed for [Desmos API v1.9](https://www.desmos.com/api/v1.9/docs/index.html). You may get errors or unexpected behavior when using with another version.

The public interface is currently:

- Make sure `Desmos` is a global variable.
- `editor = new TextModeEditor({calc: Calc, parent: div})` to mount to a node.
- `editor.dispose()` to remove the view.

Example:

```ts
import { TextModeEditor } from "@desmodder/text-mode-editor";

const textModeContainer = document.getElementById("text-mode-container");
const graphContainer = document.getElementById("graph-container");

const Calc = Desmos.GraphingCalculator(graphContainer);
const editor = new TextModeEditor({
  calc: Calc,
  parent: textModeContainer,
});

// When you need to delete the view
editor.dispose();
```
