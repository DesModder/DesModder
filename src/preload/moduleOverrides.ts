import expressionEditActions from "./moduleOverrides/expression-edit-actions";
import expressionView from "./moduleOverrides/expression_view";
import expressionsHeader from "./moduleOverrides/expressions-header";
import folderView from "./moduleOverrides/folder-view";
import genericView from "./moduleOverrides/generic-view";
import listView from "./moduleOverrides/list-view";
import mainController from "./moduleOverrides/main__controller";
import mainEvaluator from "./moduleOverrides/main__evaluator";
import workerSrcUnderlying from "./moduleOverrides/text__worker_src_underlying";
import tooltippedError from "./moduleOverrides/tooltipped-error";
import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  "dcgview-helpers/tooltipped-error": tooltippedError,
  "expressions/expressions-header": expressionsHeader,
  "expressions/list-view": listView,
  "expressions/expression-edit-actions": expressionEditActions,
  "main/controller": mainController,
  "expressions/expression_view": expressionView,
  "expressions/image-view": genericView,
  "expressions/table-view": genericView,
  "expressions/text_view": genericView,
  "expressions/folder-view": folderView,
  "text!worker_src_underlying": workerSrcUnderlying,
  "main/evaluator": mainEvaluator,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
