import { Calc, jquery, keys, desmosRequire } from "desmodder";
import { TableModel } from "../../globals/Calc";

export default function duplicateExpression(id: string) {
  const model = Calc.controller.getItemModel(id);
  if (!model) return;
  if (model.type === "expression") {
    Calc.controller.dispatch({
      type: "duplicate-expression",
      id: id,
    });
  } else if (model.type === "table") {
    duplicateTable(model as TableModel & { index: number });
  }
}

function duplicateTable(model: TableModel & { index: number }) {
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
