# Text Mode Core

This module is currently still quite entangled with [DesModder](https://github.com/DesModder/DesModder/), so the API is terrible and very much subject to change.

Here's what you probably want to use for now, assuming a global Desmos object `Desmos` and calculator `Calc`:

```ts
import {
  buildConfigFromGlobals,
  textToRaw,
  rawToText,
} from "@desmodder/text-mode-core";

const cfg = buildConfigFromGlobals(Desmos, Calc);

console.log(textToRaw(cfg, "y = sin(x)"));

console.log(rawToText(cfg, Calc.getState()));
```
