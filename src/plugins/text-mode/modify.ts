import { ProgramAnalysis } from "./LanguageServer";
import {
  rawNonFolderToAug,
  rawToAugSettings,
  rawToDsmMetadata,
} from "./aug/rawToAug";
import TextAST, { NodePath, Settings, Statement } from "./down/TextAST";
import {
  docToString,
  exprToTextString,
  styleEntryToText,
} from "./up/astToText";
import { itemAugToAST } from "./up/augToAST";
import { graphSettingsToText, itemToText } from "./up/augToText";
import { ChangeSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import Metadata from "main/metadata/interface";

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
  type: (typeof relevantEventTypes)[number];
};

type ToChange = "table-columns" | "latex-only" | "image-pos" | "regression";

export function eventSequenceChanges(
  view: EditorView,
  events: RelevantEvent[],
  analysis: ProgramAnalysis
): ChangeSpec[] {
  let settingsChanged: boolean = false;
  const itemsChanged: Record<string, ToChange> = {};
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
              change.move_strategy?.length === 2 ? "latex-only" : "image-pos";
          else if (change.regression !== undefined)
            itemsChanged[changeID] = "regression";
          else if (change.column_data !== undefined)
            itemsChanged[changeID] = "table-columns";
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
      ...itemChange(analysis, state, dsmMetadata, changeID, toChange, view)
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
    analysis.ast.children,
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
  toChange: ToChange,
  view: EditorView
): ChangeSpec[] {
  const newStateItem = state.expressions.list.find((e) => e.id === changeID);
  if (!newStateItem || newStateItem.type === "folder") return [];
  const oldNode = analysis.mapIDstmt[changeID];
  if (oldNode === undefined) return [];
  const itemAug = rawNonFolderToAug(newStateItem, dsmMetadata);
  if (itemAug.error) throw new Error("Expected valid itemAug in modify");
  switch (toChange) {
    case "table-columns": {
      if (oldNode.type !== "Table" || itemAug.type !== "table")
        throw new Error(
          "Programming Error: expected table on a table-columns change"
        );
      const ast = itemAugToAST(itemAug) as TextAST.Table | null;
      if (ast === null)
        throw new Error(
          "Programming error: expect new table item to always be parseable"
        );
      if (ast.columns.length < oldNode.columns.length)
        throw new Error(
          "Programming error: expect no fewer new table columns than old"
        );
      return oldNode.columns.map((e, i) =>
        insertWithIndentation(
          view,
          e.expr.pos!,
          exprToTextString(new NodePath(ast.columns[i].expr, null))
        )
      );
    }
    case "latex-only": {
      if (oldNode.type !== "ExprStatement" || itemAug.type !== "expression")
        throw new Error(
          "Programming Error: expected expression on a latex-only change"
        );
      const ast = itemAugToAST(itemAug) as TextAST.ExprStatement | null;
      if (ast === null)
        throw new Error(
          "Programming error: expect new expr item to always be parseable"
        );
      return [
        insertWithIndentation(
          view,
          oldNode.expr.pos!,
          exprToTextString(new NodePath(ast.expr, null))
        ),
      ];
    }
    case "image-pos": {
      if (oldNode.type !== "Image" || itemAug.type !== "image")
        throw new Error(
          "Programming Error: expected image on an image-pos change"
        );
      const ast = itemAugToAST(itemAug) as TextAST.Image | null;
      if (ast === null)
        throw new Error(
          "Programming error: expect new image item to always be parseable"
        );
      const newEntries = ast.style!.entries;
      const oldEntries = oldNode.style!.entries;
      return newEntries
        .filter((e) => ["width", "height", "center"].includes(e.property.value))
        .map((newEntry) => {
          const oldEntry = oldEntries.find(
            (e) => e.property.value === newEntry.property.value
          );
          const text = docToString(
            styleEntryToText(new NodePath(newEntry, null))
          );
          if (oldEntry) return insertWithIndentation(view, oldEntry.pos!, text);
          else {
            const prevEnd = oldEntries[oldEntries.length - 1].pos!.to;
            const isComma = view.state.sliceDoc(prevEnd, prevEnd + 1) === ",";
            const insertPos = prevEnd + (isComma ? 1 : 0);
            return insertWithIndentation(
              view,
              {
                from: insertPos,
                to: insertPos,
              },
              (isComma ? "" : ",") + "\n" + text + ","
            );
          }
        });
    }
    case "regression":
      return [insertWithIndentation(view, oldNode.pos!, itemToText(itemAug))];
  }
}

function insertWithIndentation(
  view: EditorView,
  pos: TextAST.Pos,
  insert: string
) {
  const indentation = getIndentation(view, pos.from);
  return {
    from: pos.from,
    to: pos.to,
    insert: insert.replace(/\n/g, "\n" + indentation),
  };
}

export function getIndentation(view: EditorView, from: number) {
  const line = view.state.doc.lineAt(from);
  return line.text.match(/^[ \t]*/)![0];
}
