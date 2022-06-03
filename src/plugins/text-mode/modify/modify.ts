import { ChangeSpec } from "@codemirror/state";
import { Tree, SyntaxNode } from "@lezer/common";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import { rawToAugSettings } from "../aug/rawToAug";
import { graphSettingsToText } from "../up/augToText";

export const relevantEventTypes = [
  // @settings related
  "set-axis-limit-latex",
  "re-randomize",
  "toggle-lock-viewport",
  "commit-user-requested-viewport",
  "grapher/drag-end",
  "set-graph-settings",
  "zoom",
  // TODO: rest of useful events
  // sliders, draggable points, action updates, etc.
] as const;

export type RelevantEvent = DispatchedEvent & {
  type: typeof relevantEventTypes[number];
};

export function eventSequenceChanges(
  events: RelevantEvent[],
  tree: Tree
): ChangeSpec[] {
  let settingsChanged: boolean = false;
  for (const event of events) {
    switch (event.type) {
      case "re-randomize":
      case "set-axis-limit-latex":
      case "toggle-lock-viewport":
      case "commit-user-requested-viewport":
      case "set-graph-settings":
      case "zoom":
      case "grapher/drag-end":
        settingsChanged = true;
        break;
      default:
        console.log("Ignored event:", event);
    }
  }
  const changes: ChangeSpec[] = [];
  if (settingsChanged) {
    const state = Calc.getState();
    const newSettingsText = graphSettingsToText(rawToAugSettings(state));
    const settingsNode = getSettingsNode(tree);
    if (settingsNode) {
      changes.push({
        from: settingsNode.from,
        to: settingsNode.to,
        insert: newSettingsText,
      });
    } else {
      changes.push({
        from: 0,
        to: 0,
        insert: newSettingsText + "\n",
      });
    }
  }
  return changes;
}

function getSettingsNode(tree: Tree): SyntaxNode | null {
  const cursor = tree.cursor();
  const hasFirstChild = cursor.firstChild();
  if (!hasFirstChild) return null;
  do {
    if (cursor.node.type.name === "Settings") return cursor.node;
  } while (cursor.nextSibling());
  return null;
}
