# Dispatch Handling

There are three primary ways to cause changes in state of a calculator's controller (`Calc.controller`):

1. Officially, through the `Calc` interfaces like `Calc.setExpression()`. All official APIs are directly on the `Calc` object and are very stable.
2. Dispatching vanilla actions, like `Calc.controller.dispatch({ type: "set-selected-id", id: "1" });`. Most of these wouldn't change unless there's a UI overhaul, but there's always some risk involved.
3. Custom actions, which allow you to call internal functions like `Calc.controller._toplevelReplaceItemAt(index, model, focus)`. This is risky since these internal functions can change at any time. However, these provide the most control.

### Observing Changes

There is an official API for observing changes that affect the persisted graph state:

```js
Calc.observeEvent("change", () => console.log(Calc.getState()));
```

The only way this tends to be useful is by obtaining `Calc.getState()` in the callback, then either computing directly from that state, or comparing it with an earlier version of the sate.

The approach for observing dispatched actions is by registering a listener:

```js
Calc.controller.dispatcher.register((action) => console.log(action));
```

The listener is not allowed to dispatch any actions (this causes a dispatch-in-dispatch error). If you really want to dispatch an action, then consider `Calc.controller.runAfterDispatch`, but this often has issues with getting undo/redo to work properly.

TODO-cleanup: Refactor existing `setTimeout(() => {})` to `cc.runAfterDispatch(() => {})`, and investigate if there are better approaches than a `runAfterDispatch`. Maybe directly call `handleDispatchedAction`, or switch to "Custom actions".

### Dispatching vanilla actions

This API is relatively simple to do. Suppose you want to delete one expression automatically. The first step is to listen for what action you need to dispatch. Run

```js
Calc.controller.dispatcher.register(console.log);
```

Then, delete an expression and see what gets logged. The first action logged after clicking the "X" is

```js
{
  type: "delete-item-and-animate-out",
  id: "1",
  setFocusAfterDelete: true,
};
```

So you could delete the expression with id `'2'` by dispatching

```js
Calc.controller.dispatch({
  type: "delete-item-and-animate-out",
  id: "2",
  setFocusAfterDelete: true,
});
```

Easy as that. However, if you wanted to delete multiple expressions at the same time, this approach would have a problem: If the user tries to undo it, then each expression would be undo'd one expression at a time. As a rule of thumb, if you put a `Calc.controller.dispatch` inside a loop, then you're probably going to break the undo/redo stack. In that scenario, you'll have to try a different action, or use the final approach, "Custom actions".

### Custom actions

All of Desmos's vanilla (built-in) action dispatches are implemented by this approach, but it's less safe to do this in DesModder since Desmos internals can change at will.

However, this approach has the advantage of tending to get undo/redo correct by default. Also, as compared to dispatching vanilla actions, you get more freedom, like being able to delete several expressions at once.

Conceptually, the `Calc.controller` has the following code ran when the calculator is first loaded (letting `cc = Calc.controller` for brevity):

```js
cc.dispatcher.register((action) => {
  const focusedBeforeDispatch = cc.getFocusLocation();
  cc.handleDispatchedAction(action);
  cc.updateTheComputedWorld();
  if (action.type !== "undo" && action.type !== "redo") {
    cc.commitUndoRedoSynchronously(action);
  }
  if (focusedBeforeDispatch !== focusedAfterDispatch) {
    // ...
  }
  cc.updateViews();
});
```

This is the main action loop of the controller.

- This uses the same `cc.dispatcher.register` API you might use to listen to changes.
- `cc.handleDispatchedAction` is a huge switch statement over all the possible actions.
- There is some logic before and after `cc.handleDispatchedAction`, importantly handling undo/redo state.

To create custom actions that work as confidently as vanilla actions, we replace `cc.handleDispatchedAction` with our own version that can handle our custom actions. This is all hooked up to work automatically. As a plugin developer, there are just two steps to getting custom actions.

Step 1: Add imports, and declare the new actions by extending the `AllActions` interface using TypeScript magic (module augmentation and interface merging).

```ts
import { AllActions, DispatchedEvent } from "../../globals/extra-actions";

// Tutorial: These next two lines are just "magic"
declare module "src/globals/extra-actions" {
  interface AllActions {
    // Tutorial: This next line should be the ID of the plugin
    "folder-tools": {
      // Tutorial: The type of the new actions you're declaring.
      // We currently prefix liberally since this shares the
      // namespace with vanilla Desmos and with all the other plugins.
      type:
        | "dsm-folder-tools-folder-dump"
        | "dsm-folder-tools-folder-merge"
        | "dsm-folder-tools-note-enclose";
      index: number;
      id: string;
    };
  }
}
```

Step 2: Handle the new actions by declaring the `handleDispatchedAction` on the plugin controller.

```ts
handleDispatchedAction(action: DispatchedEvent) {
  switch (action.type) {
    case "dsm-folder-tools-folder-dump":
      this.folderDump(action.index);
      break;
    case "dsm-folder-tools-folder-merge":
      this.folderMerge(action.index);
      break;
    case "dsm-folder-tools-note-enclose":
      this.noteEnclose(action.index);
      break;
    default:
      // Tutorial: If a plugin declares a new action but doesn't handle it, then
      // the action simply does nothing. This `satisfies` statement ensures
      // that this plugin at least handles all the actions it declares.
      // Remember to change `"folder-tools"` to the actual plugin ID.
      action satisfies Exclude<DispatchedEvent, AllActions["folder-tools"]>;
  }
  return undefined;
}
```
