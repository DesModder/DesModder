import { getTextModeConfig } from ".";
import {
  rawNonFolderToAug,
  rawToAugSettings,
  rawToDsmMetadata,
  ProgramAnalysis,
  astItemToTextString,
  docToString,
  exprToTextString,
  styleEntryToText,
  childExprToAug,
  itemAugToAST,
  graphSettingsToText,
  itemToText,
} from "../../../text-mode-core";
import TextAST, {
  NodePath,
  Settings,
  Statement,
} from "../../../text-mode-core/TextAST";
import { ChangeSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import Metadata from "plugins/manage-metadata/interface";

// @settings related
const settingsEvents = [
  "set-axis-limit-latex",
  "re-randomize",
  "toggle-lock-viewport",
  "commit-user-requested-viewport",
  "grapher/drag-end",
  "set-graph-settings",
  "zoom",
  "resize-exp-list", // resize-exp-list can update viewport size
] as const;

type ToChange = "table-columns" | "latex-only" | "image-pos" | "regression";

export function eventSequenceChanges(
  view: EditorView,
  event: DispatchedEvent,
  analysis: ProgramAnalysis
): ChangeSpec[] {
  const state = Calc.getState();
  if (event.type === "on-evaluator-changes") {
    // sliders, draggable points, action updates, etc.
    return evaluatorChange(analysis, state, view, event);
  } else if ((settingsEvents as readonly string[]).includes(event.type)) {
    return [settingsChange(analysis, state)];
  } else {
    const res = [];
    if ("id" in event && event.id !== undefined) {
      const dsmMetadata = rawToDsmMetadata(state);
      res.push(metadataChange(analysis, state, dsmMetadata, view, event.id));
      if (
        event.type === "convert-image-to-draggable" ||
        event.type === "create-sliders-for-item"
      ) {
        res.push(newItemsChange(analysis, state, dsmMetadata, view));
      }
    }
    return res;
  }
}

function evaluatorChange(
  analysis: ProgramAnalysis,
  state: GraphState,
  view: EditorView,
  event: DispatchedEvent & { type: "on-evaluator-changes" }
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  const itemsChanged: Record<string, ToChange> = {};
  for (const [changeID, change] of Object.entries(event.changes)) {
    if (
      change.raw_slider_latex !== undefined ||
      change.zero_values !== undefined
    ) {
      // change.raw_slider_latex e.g. a slider was played.
      // This is also triggered on first update of a slider
      // Filtering out unnecessary re-writes is done later in itemChange
      // change.zero_values is for lists: action updates
      itemsChanged[changeID] = "latex-only";
    } else if (
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
    analysis.program.children,
    (stmt): stmt is Settings => stmt.type === "Settings"
  );
  return settingsNode
    ? {
        from: settingsNode.pos.from,
        to: settingsNode.pos.to,
        insert: newSettingsText,
      }
    : {
        from: 0,
        to: 0,
        insert: newSettingsText + "\n\n",
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

function metadataChange(
  analysis: ProgramAnalysis,
  state: GraphState,
  dsmMetadata: Metadata,
  view: EditorView,
  id: string
): ChangeSpec {
  const oldNode = analysis.mapIDstmt[id];
  if (
    !oldNode ||
    (oldNode.type !== "ExprStatement" && oldNode.type !== "Image")
  )
    return [];
  const expr = state.expressions.list.find((x) => x.id === id);
  if (!expr || (expr.type !== "expression" && expr.type !== "image")) return [];
  const itemAug = rawNonFolderToAug(getTextModeConfig(), expr, dsmMetadata);
  const afterEnd = oldNode.pos.to;
  const pos = oldNode.style?.pos ?? { from: afterEnd, to: afterEnd };
  const ast = itemAugToAST(itemAug);
  if (!ast) return [];
  const fullItem = astItemToTextString(ast);
  const newStyle = /@\{[^]*/m.exec(fullItem)?.[0];
  const insert = (!oldNode.style && newStyle ? " " : "") + (newStyle ?? "");
  return insertWithIndentation(view, pos, insert);
}

/** Used for convert-image-to-draggable and add-sliders-to-item. */
function newItemsChange(
  analysis: ProgramAnalysis,
  state: GraphState,
  dsmMetadata: Metadata,
  view: EditorView
): ChangeSpec {
  let pos = 0;
  const out: ChangeSpec[] = [];
  for (const item of state.expressions.list) {
    if (item.type === "folder") continue;
    const stmt = analysis.mapIDstmt[item.id];
    if (stmt) {
      pos = stmt.pos.to;
    } else {
      const aug = rawNonFolderToAug(getTextModeConfig(), item, dsmMetadata);
      const ast = itemAugToAST(aug);
      if (!ast) continue;
      const insert = "\n\n" + astItemToTextString(ast);
      out.push(insertWithIndentation(view, { from: pos, to: pos }, insert));
    }
  }
  return out;
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
  const itemAug = rawNonFolderToAug(
    getTextModeConfig(),
    newStateItem,
    dsmMetadata
  );
  if (itemAug.error) return [];
  switch (toChange) {
    case "table-columns": {
      // Table column updates from dragging a point
      // Also includes updates from just calculating the values
      // Overwrite if and only if the editor is unfocused:
      //   - point dragging can only occur when editor is unfocused
      //   - overwriting is not harmful when the editor is unfocused
      if (view.hasFocus) return [];
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
          e.expr.pos,
          exprToTextString(ast.columns[i].expr)
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
      if (childExprAugString(oldNode.expr) === childExprAugString(ast.expr))
        return [];
      return [
        insertWithIndentation(
          view,
          oldNode.expr.pos,
          exprToTextString(ast.expr)
        ),
      ];
    }
    case "image-pos": {
      // Image pos updates from dragging a handle
      // Also includes updates from just calculating the values
      // Overwrite if and only if the editor is unfocused:
      //   - image dragging/resizing can only occur when editor is unfocused
      //   - overwriting is not harmful when the editor is unfocused
      if (view.hasFocus) return [];
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
          if (oldEntry) return insertWithIndentation(view, oldEntry.pos, text);
          else {
            const prevEnd = oldEntries[oldEntries.length - 1].pos.to;
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
    case "regression": {
      if (oldNode.type !== "ExprStatement" || itemAug.type !== "expression")
        throw new Error(
          "Programming Error: expected expression on a regression change"
        );
      const text = itemToText(itemAug);
      // we trust there's only one "#{" since this is our itemToText
      const params = "#{" + text.split("#{")[1];
      // only modify the parameters
      if (!oldNode.parameters) {
        const to = oldNode.pos.to;
        return [insertWithIndentation(view, { from: to, to }, " " + params)];
      } else {
        return [insertWithIndentation(view, oldNode.parameters.pos, params)];
      }
    }
  }
}

function childExprAugString(expr: TextAST.Expression) {
  return JSON.stringify(childExprToAug(expr));
}

function insertWithIndentation(
  view: EditorView,
  pos: TextAST.Pos,
  insert: string
): ChangeSpec {
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
