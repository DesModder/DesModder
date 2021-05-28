import { Calc, desmosRequire } from "desmodder";
import { ItemModel, TableModel, TextModel } from "../../globals/Calc";

type Indexed<T> = T & { index: number };

export default function duplicateExpression(id: string) {
  const model = Calc.controller.getItemModel(id) as Indexed<ItemModel>;
  if (!model) return;
  switch (model.type) {
    case "expression":
      Calc.controller.dispatch({
        type: "duplicate-expression",
        id: id,
      });
      break;
    case "table":
      duplicateTable(model);
      break;
    case "text":
      duplicateText(model);
      break;
  }
}

function duplicateTable(model: Indexed<TableModel>) {
  const state = desmosRequire("graphing-calc/models/table").getState(model, {
    stripDefaults: false,
  }) as TableModel;
  // Since this is a table, need to change column headers if they are variables
  const subscript = Calc.controller.generateTableXSubscript();
  let letterIndex = 0;
  // assume that there are 26 or fewer variables defined in the table
  const letters = "xyzwabcdefghijklmnopqrstuv";
  const newState = {
    ...state,
    columns: state.columns.map((column) => ({
      ...column,
      id: Calc.controller.generateId(),
      latex: column?.values?.some((e) => e !== "")
        ? // assume, since some value is filled in, this is a definition
          `${letters[letterIndex++]}_${subscript}`
        : column.latex,
    })),
    id: Calc.controller.generateId(),
  };
  // perform the actual insertion
  Calc.controller.dispatch({
    type: "insert-item-at-index",
    index: model.index + 1,
    state: newState,
    focus: true,
    folderId: state.folderId,
  });
}

function duplicateText(model: Indexed<TextModel>) {
  const state = desmosRequire("graphing-calc/models/text").getState(model, {
    stripDefaults: false,
  });
  Calc.controller.dispatch({
    type: "insert-item-at-index",
    index: model.index + 1,
    state: {
      ...state,
      id: Calc.controller.generateId(),
    },
    focus: true,
    folderId: state.folderId,
  });
}
