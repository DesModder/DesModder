import { ChangeSpec } from "@codemirror/state";
import { GraphState } from "@desmodder/graph-state";
import { Tree, SyntaxNode } from "@lezer/common";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import {
  rawNonFolderToAug,
  rawToAugSettings,
  rawToDsmMetadata,
} from "../aug/rawToAug";
import { graphSettingsToText, itemToText } from "../up/augToText";
import Metadata from "main/metadata/interface";
import LanguageServer from "../LanguageServer";

export const relevantEventTypes = [
  // @settings related
  "set-axis-limit-latex",
  "re-randomize",
  "toggle-lock-viewport",
  "commit-user-requested-viewport",
  "grapher/drag-end",
  "set-graph-settings",
  "zoom",
  "resize-exp-list", // resize-exp-list can update viewport size
  // sliders, draggable points, action updates, etc.
  "on-evaluator-changes",
] as const;

export type RelevantEvent = DispatchedEvent & {
  type: typeof relevantEventTypes[number];
};

export function eventSequenceChanges(
  ls: LanguageServer,
  events: RelevantEvent[],
  tree: Tree
): ChangeSpec[] {
  let settingsChanged: boolean = false;
  let itemsChanged: Set<string> = new Set();
  for (const event of events) {
    switch (event.type) {
      case "re-randomize":
      case "set-axis-limit-latex":
      case "toggle-lock-viewport":
      case "commit-user-requested-viewport":
      case "set-graph-settings":
      case "zoom":
      case "grapher/drag-end":
      case "resize-exp-list":
        settingsChanged = true;
        break;
      case "on-evaluator-changes":
        for (const [changeID, change] of Object.entries(event.changes)) {
          if (
            change.constant_value !== undefined ||
            change.raw_slider_latex !== undefined ||
            change.zero_values !== undefined ||
            // TODO: move_strategy also gets omitted when the viewport is panned
            // even if the point was not dragged. Only difference in the events
            // seem to be  the coordinates to update, so check that
            change.move_strategy !== undefined ||
            change.regression !== undefined ||
            change.column_data !== undefined
          ) {
            itemsChanged.add(changeID);
          }
        }
        break;
    }
  }
  const changes: ChangeSpec[] = [];
  const state = Calc.getState();
  if (settingsChanged) {
    changes.push(settingsChange(tree, state));
  }
  if (itemsChanged.size > 0) {
    const dsmMetadata = rawToDsmMetadata(state);
    for (const changeID of itemsChanged.values()) {
      changes.push(...itemChange(ls, tree, state, dsmMetadata, changeID));
    }
  }
  return changes;
}

function settingsChange(tree: Tree, state: GraphState): ChangeSpec {
  const newSettingsText = graphSettingsToText(rawToAugSettings(state));
  const settingsNode = getSettingsNode(tree);
  return settingsNode
    ? {
        from: settingsNode.from,
        to: settingsNode.to,
        insert: newSettingsText,
      }
    : {
        from: 0,
        to: 0,
        insert: newSettingsText + "\n",
      };
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

function itemChange(
  ls: LanguageServer,
  tree: Tree,
  state: GraphState,
  dsmMetadata: Metadata,
  changeID: string
): ChangeSpec[] {
  const newStateItem = state.expressions.list.find((e) => e.id === changeID);
  if (!newStateItem || newStateItem.type === "folder") return [];
  const oldNode = getItemNode(ls, tree, changeID);
  if (oldNode === null) return [];
  const itemAug = rawNonFolderToAug(newStateItem, dsmMetadata);
  const newItemText = itemToText(itemAug);
  return [
    {
      from: oldNode.from,
      to: oldNode.to,
      insert: newItemText,
    },
  ];
}

function getItemNode(
  ls: LanguageServer,
  tree: Tree,
  id: string
): SyntaxNode | null {
  const startPos = ls.mapIDPosition[id];
  if (startPos === undefined) return null;
  const cursor = tree.cursor();
  cursor.childAfter(startPos);
  // Assume this is the correct node
  return cursor.node;
}
