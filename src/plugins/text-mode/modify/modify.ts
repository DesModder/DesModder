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
import Controller from "../Controller";

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
  controller: Controller,
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
            change.raw_slider_value !== undefined ||
            change.zero_values !== undefined ||
            change.move_strategy !== undefined ||
            change.regression !== undefined
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
      changes.push(
        ...itemChange(controller, tree, state, dsmMetadata, changeID)
      );
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
  controller: Controller,
  tree: Tree,
  state: GraphState,
  dsmMetadata: Metadata,
  changeID: string
): ChangeSpec[] {
  const newStateItem = state.expressions.list.find((e) => e.id === changeID);
  if (!newStateItem || newStateItem.type === "folder") return [];
  const oldNode = getItemNode(controller, tree, changeID);
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
  controller: Controller,
  tree: Tree,
  id: string
): SyntaxNode | null {
  const startPos = controller.mapIDPosition[id];
  if (startPos === undefined) return null;
  const cursor = tree.cursor();
  cursor.childAfter(startPos);
  // Assume this is correct
  return cursor.node;
}
