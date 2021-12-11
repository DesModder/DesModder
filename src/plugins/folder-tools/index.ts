export default {
  id: "folder-tools",
  name: "Folder Tools",
  description: "Adds buttons in edit-list-mode to help manage folders.",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  alwaysEnabled: false,
  enabledByDefault: true,
  /* Has module overrides */
} as const;

/*

To fix the state stack (undo/redo) problem we need to call Calc.controller.commitUndoRedoSynchronously
at some point. This is currently only used in dispatch handling in setupDispatcher.

Probably also want to updateTheComputedWorld or something.

Might be easiest to just change handleDispatchedAction to handle custom DesModder actions. Then avoid
dispatch-in-dispatch, yay.
  1. tweak handleDispatchedAction just barely enough to fix undo/redo and expression render after merge/dump/enclose
  2. migrate existing code to handleDispatchedAction whenever a new bug appears (no need to change old code immediately)

Ignore DesModder metadata folder in merge/enclose
*/
