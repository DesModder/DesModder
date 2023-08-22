# Dataflow

## Motivation

DesModder is in the process of de-coupling plugins with the express purpose of making it easy for e.g. a Tampermonkey script to register plugins.

One difficulty here is in communication:

- One plugin might want to get some data from another plugin, e.g. don't show pinned expressions if Text Mode is enabled.
- One plugin might want to get some data from several other plugins, e.g. extra-expr-buttons uses several other plugins as data sources, which provide the pin-expression button and the folder-tools buttons.
- Replacement code must be able to access data and views from other plugins.

DesModder's model for this is based on [Codemirror's system to do the same](https://codemirror.net/examples/config/). It even uses Codemirror's system under the hood, but you need not worry about that. (Codemirror relies on referential equality, which would require having import access to other plugins. DesModder allows any field to be referenced by a string).

## Explanation: Computed

The simplest form of data transfer is when a plugin provides a value to be consumed elsewhere. For example, Text Mode needs to expose the button that toggles Text Mode.

Step 1: Define the facet in the type system. This step is technically optional but saves a bunch of type assertions.

```ts
import { Inserter } from "../../preload/replaceElement";

declare module "dataflow" {
  interface Computed {
    textModeToggle: Inserter;
  }
}
```

The first couple lines after the import declare that we're going to extend the interface called `Computed` inside `src/dataflow.ts`. Then we actually extend it by declaring the `textModeToggle` facet whose value is an `Inserter` (a function that returns a DCGView element).

Step 2: Provide the value of the facet. This would go inside a plugin controller.

```ts
import { DCGView } from "DCGView";
import { compute, facetSourcesSpec } from "dataflow";

export default class TextMode extends PluginController {
  // ... the main class is omitted; we're jumping right to where the facet value is provided ...

  computed = facetSourcesSpec({
    textModeToggle: {
      value: () =>
        DCGView.createElement(
          "span",
          { role: "button", onTap: () => this.toggleTextMode() },
          "toggle"
        ),
    },
  });
}
```

This defined the value of the `textModeToggle` facet to be a function that returns a particular DCGView element.

The purpose of `facetSourcesSpec` is to help with type hints. So if you wrote `textModeToggle: { value: 5 }`, then you would get the helpful error message `Type 'number' is not assignable to type 'Inserter'.`

Step 3: Use the value.

```js
// In a replacement somewhere
DCGView.createElement(
  DCGView.Components.If,
  { predicate: () => !Calc.controller.isInEditListMode() },
  () => {
    // There's a better way, keep reading.
    const inserter = DSM.facet("textModeToggle");
    if (inserter) return inserter();
    else return null;
  }
);
```

Note `DSM.facet("textModeToggle")` typically returns an `Inserter`, a function that returns a DCGView element, so we can call the inserter function to get the element. But if the Text Mode plugin is disabled, then all of its facets are set to `undefined` instead. So we need to check if it's defined by using `if (inserter)`.

This is a common enough operation that there's a better way:

```js
// In a replacement somewhere
DCGView.createElement(
  DCGView.Components.If,
  { predicate: () => !Calc.controller.isInEditListMode() },
  () => DSM.insertFacetElement("textModeToggle")
);
```

The `DSM.insertFacetElement` helper handles all that logic. There's also some omitted logic handled as well: when Text Mode is disabled, it tells DCGView that the element changed, so it can update its cached tree representation. This is handled by inserting a `<Switch>` element (effectively behaving like an `<If>`).

## Explanation: Combiner Facets

The above `Computed` approach turns out to be a special case of a more complicated approach. The above approach could only handle one plugin providing the value of the facet. In general, you might want to allow several plugins to contribute values, and designate one plugin to combine them.

An example use case is the Expr Action Buttons plugin. The one plugin handles showing the buttons, while other plugins (currently: Pin Expressions and Folder Tools) contribute which buttons to show.

Step 1: Define the value in the type system. This time, we use the `Facets` interface instead of the `Computed` interface. Instead of defining one type as the value, we define one type as the input and one type for the output.

```ts
declare module "dataflow" {
  interface Facets {
    exprActionButtons: {
      input: ActionButtonSpec;
      output: Inserter;
    };
  }
}
```

Step 2: Provide the value of the facet. This time, it's not fixed as a single value, so you're just providing how to compute the value of the facet given an array of inputs by combining them together in some way.

```ts
export default class ExprActionButtons extends PluginController {
  // ... the main class is omitted; we're jumping right to where the facet value is provided ...

  facets = facetsSpec({
    exprActionButtons: {
      combine: (values: ActionButtonSpec[]) => {
        const order = values.flatMap(({ plugin, buttons }) =>
          buttons.map((b, i) => ({ ...b, key: `${plugin}:${i}` }))
        );
        return () => ActionButtons(order);
      },
    },
  });
}
```

Notice this uses `facets = facetsSpec({...})` instead of `computed = facetSourcesSpec({...})`.

What the combiner function does is take a bunch of `ActionButtonSpec`s that other plugins have provided, map them to specific buttons, then call the `ActionButtons` function to get a DCGView element out of the mix. Recall the output of the facet must be an `Inserter`, a function that returns a DCGView element.

Step 2.5: Provide the inputs to the facet.

```ts
export default class PinExpressions extends PluginController {
  facetSources = facetSourcesSpec({
    exprActionButtons: {
      value: {
        plugin: "pin-expressions",
        buttons: [
          {
            buttonClass: "dsm-pin-button",
            onTap: (model) => this.pinExpression(model.id),
            predicate: (model) => !this.isExpressionPinned(model.id),
          },
          {
            buttonClass: "dsm-unpin-button dcg-selected",
            onTap: (model) => this.unpinExpression(model.id),
            predicate: (model) => this.isExpressionPinned(model.id),
          },
        ],
      },
    },
  });
}
```

Notice this uses `facetSources = facetSourcesSpec({...})` which is more similar to `computed = facetSourcesSpec({...})`.

Step 3: Use the facet.

This goes the same way as before

```js
// In a replacement somewhere
DSM.insertFacetElement("exprActionButtons");
```
