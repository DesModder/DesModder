import { Calc, desmosRequire } from "desmodder";
import {
  ItemModel,
  TableModel,
  TextModel,
  ImageModel,
  FolderModel,
  ExpressionModel,
} from "globals/Calc";

type Indexed<T> = T & { index: number };

function insertItemAtIndex(
  index: number,
  // lazy type for the state
  state: any,
  focus: boolean,
  folderId?: string
) {
  Calc.controller.dispatch({
    type: "insert-item-at-index",
    index,
    state,
    focus,
    folderId,
  });
}

const getStates = {
  expression: desmosRequire("graphing-calc/models/expression"),
  table: desmosRequire("graphing-calc/models/table"),
  text: desmosRequire("graphing-calc/models/text"),
  image: desmosRequire("graphing-calc/models/image"),
  folder: desmosRequire("graphing-calc/models/folder"),
};

export default function duplicateExpression(id: string) {
  const model = Calc.controller.getItemModel(id) as Indexed<ItemModel>;
  if (!model) return;
  if (model.type === "folder") {
    duplicateFolder(model);
  } else {
    const state = getStates[model.type ?? "expression"].getState(model, {
      stripDefaults: false,
    });
    const newState = duplicatedNonFolder(state);
    // perform the actual insertion
    insertItemAtIndex(model.index + 1, newState, true, model.folderId);
  }
}

function duplicateFolder(model: Indexed<FolderModel>) {
  const newFolderId = Calc.controller.generateId();
  const oldExpressions = Calc.getState().expressions.list;
  const numChildren = oldExpressions.filter(
    (e) => e.type !== "folder" && e.folderId === model.id
  ).length;
  // the duplicated folder will go after the existing folder
  insertItemAtIndex(
    model.index + numChildren + 1,
    {
      ...getStates.folder.getState(model, { stripDefaults: false }),
      id: newFolderId,
    },
    true
  );
  // assumes all child folders are consecutively after to parent folder
  for (let i = model.index + 1; i <= model.index + numChildren; i++) {
    const expr = oldExpressions[i];
    insertItemAtIndex(
      i + numChildren + 1,
      {
        ...duplicatedNonFolder(expr),
        folderId: newFolderId,
      },
      false,
      newFolderId
    );
  }
}

function duplicatedNonFolder(state: ItemModel) {
  switch (state.type) {
    case "table":
      return duplicatedTable(state);
    case "expression":
    case "text":
    case "image":
      return duplicatedSimple(state);
  }
}

function duplicatedTable(state: TableModel) {
  // Since this is a table, need to change column headers if they are variables
  const subscript = Calc.controller.generateTableXSubscript();
  let letterIndex = 0;
  // assume that there are 26 or fewer variables defined in the table
  const letters = "xyzwabcdefghijklmnopqrstuv";
  return {
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
}

function duplicatedSimple(state: ExpressionModel | TextModel | ImageModel) {
  return {
    ...state,
    id: Calc.controller.generateId(),
  };
}
