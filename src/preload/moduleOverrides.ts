import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";
import tooltippedError from "./moduleOverrides/tooltipped-error";
import expressionIconView from "./moduleOverrides/expression-icon-view";
import smartTextarea from "./moduleOverrides/smart_textarea";
import listView from "./moduleOverrides/list-view";
import abstractItem from "./moduleOverrides/abstract-item";
import abstractItemView from "./moduleOverrides/abstract-item-view";
import expressionEditActions from "./moduleOverrides/expression-edit-actions";
import actionsKeyboard from "./moduleOverrides/actions__keyboard";
import mainController from "./moduleOverrides/main__controller";
import expressionView from "./moduleOverrides/expression_view";
import genericView from "./moduleOverrides/generic-view";
import folderView from "./moduleOverrides/folder-view";
import workerSrcUnderlying from "./moduleOverrides/text__worker_src_underlying";

export default {
  "dcgview-helpers/tooltipped-error": tooltippedError,
  "expressions/expression-icon-view": expressionIconView,
  "expressions/smart_textarea": smartTextarea,
  "expressions/list-view": listView,
  "graphing-calc/models/abstract-item": abstractItem,
  "expressions/abstract-item-view": abstractItemView,
  "expressions/expression-edit-actions": expressionEditActions,
  "graphing-calc/actions/keyboard": actionsKeyboard,
  "main/controller": mainController,
  "expressions/expression_view": expressionView,
  "expressions/image-view": genericView,
  "expressions/table-view": genericView,
  "expressions/text_view": genericView,
  "expressions/folder-view": folderView,
  "text!worker_src_underlying": workerSrcUnderlying,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
