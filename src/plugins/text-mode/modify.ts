import { ChangeSpec } from "@codemirror/state";
import { GraphState } from "@desmodder/graph-state";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import {
  rawNonFolderToAug,
  rawToAugSettings,
  rawToDsmMetadata,
} from "./aug/rawToAug";
import { graphSettingsToText, itemToText } from "./up/augToText";
import Metadata from "main/metadata/interface";
import LanguageServer, { ProgramAnalysis } from "./LanguageServer";
import TextAST, { Settings, Statement } from "./down/TextAST";
import { itemAugToAST } from "./up/augToAST";
import { exprToText } from "./up/astToText";

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

type ToChange = "latex-only" | "all";

export function eventSequenceChanges(
  ls: LanguageServer,
  events: RelevantEvent[],
  analysis: ProgramAnalysis
): ChangeSpec[] {
  let settingsChanged: boolean = false;
  let itemsChanged: { [key: string]: ToChange } = {};
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
            change.zero_values !== undefined
          )
            itemsChanged[changeID] = "latex-only";
          else if (
            // TODO: move_strategy also gets emitted when the viewport is panned
            // even if the point was not dragged. Only difference in the events
            // seem to be the coordinates to update, so check that
            // TODO: ignore the first move_strategy after an update from
            // the text because it's always no change
            change.move_strategy !== undefined
          )
            // length 2 corresponds to dragging a point, which is latex only
            // otherwise (length 4), it is dragging an image
            itemsChanged[changeID] =
              change.move_strategy?.length === 2 ? "latex-only" : "all";
          else if (
            change.regression !== undefined ||
            change.column_data !== undefined
          )
            itemsChanged[changeID] = "all";
        }
        break;
    }
  }
  const changes: ChangeSpec[] = [];
  const state = Calc.getState();
  if (settingsChanged) {
    changes.push(settingsChange(analysis, state));
  }
  const dsmMetadata = rawToDsmMetadata(state);
  for (const [changeID, toChange] of Object.entries(itemsChanged)) {
    changes.push(
      ...itemChange(analysis, state, dsmMetadata, changeID, toChange)
    );
  }
  return changes;
}

function settingsChange(
  analysis: ProgramAnalysis,
  state: GraphState
): ChangeSpec {
  const newSettingsText = graphSettingsToText(rawToAugSettings(state));
  const settingsNode = findStatement(
    analysis.ast,
    (stmt): stmt is Settings => stmt.type === "Settings"
  );
  return settingsNode
    ? {
        from: settingsNode.pos!.from,
        to: settingsNode.pos!.to,
        insert: newSettingsText,
      }
    : {
        from: 0,
        to: 0,
        insert: newSettingsText + "\n",
      };
}

function findStatement<T extends Statement>(
  ast: Statement[],
  func: (stmt: Statement) => stmt is T
): T | null {
  for (const node of ast) {
    if (func(node)) return node;
    else if (node.type === "Folder") {
      const subFind = findStatement(node.children, func);
      if (subFind !== null) return subFind;
    }
  }
  return null;
}

function itemChange(
  analysis: ProgramAnalysis,
  state: GraphState,
  dsmMetadata: Metadata,
  changeID: string,
  toChange: ToChange
): ChangeSpec[] {
  const newStateItem = state.expressions.list.find((e) => e.id === changeID);
  if (!newStateItem || newStateItem.type === "folder") return [];
  const oldNode = analysis.mapIDstmt[changeID];
  if (oldNode === undefined) return [];
  const itemAug = rawNonFolderToAug(newStateItem, dsmMetadata);
  if (toChange === "latex-only") {
    if (oldNode.type !== "ExprStatement" || itemAug.type !== "expression")
      throw new Error(
        "Programming Error: expected expression on a latex-only change"
      );
    const ast = itemAugToAST(itemAug) as TextAST.ExprStatement | null;
    if (ast === null)
      throw "Programming error: expect new item to always be parseable";
    return [
      {
        from: oldNode.expr.pos!.from,
        to: oldNode.expr.pos!.to,
        insert: exprToText(ast.expr),
      },
    ];
  } else {
    return [
      {
        from: oldNode.pos!.from,
        to: oldNode.pos!.to,
        insert: itemToText(itemAug),
      },
    ];
  }
}
