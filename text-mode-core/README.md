# Text Mode Core

This module is currently still quite entangled with [DesModder](https://github.com/DesModder/DesModder/), so the API is terrible and very much subject to change.

Here's what you probably want to use for now, assuming a global Desmos API instance `Desmos` and calculator `Calc`:

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

If you don't have access to those, then text-mode-core can assume good defaults for most options found in the config. However, it does not have its own LaTeX parser, so you cannot convert from raw graph states to other formats.

```ts
import { buildConfig, textToRaw, rawToText } from "@desmodder/text-mode-core";

const cfg = buildConfig({});

console.log(textToRaw(cfg, "y = sin(x)"));

// WARNING: This will error because parseDesmosLatex is not defined.
// There's try-catches, so it will give a (useless) object.
rawToText(cfg, {
  version: 10,
  expressions: {
    list: [
      {
        type: "expression",
        id: "1",
        color: "#c74440",
        latex: "y=\\sin\\left(x\\right)",
      },
    ],
  },
});
```
