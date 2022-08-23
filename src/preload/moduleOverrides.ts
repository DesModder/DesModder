import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";
import tooltippedError from "./moduleOverrides/tooltipped-error";
import expressionIconView from "./moduleOverrides/expression-icon-view";
import expressionsHeader from "./moduleOverrides/expressions-header";
import keypadsMain from "./moduleOverrides/keypads__main";
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
import expressionMenusFill from "./moduleOverrides/expression-menus__fill";
import graphslayer from "./moduleOverrides/graphslayer";
import mainEvaluator from "./moduleOverrides/main__evaluator";
import expressionOptionsMenuView from "./moduleOverrides/expression-options-menu-view";
import promptSliderView from "./moduleOverrides/promptslider_view";
import instancehotkeys from "./moduleOverrides/instancehotkeys";

export default {
  "dcgview-helpers/tooltipped-error": tooltippedError,
  "expressions/expression-icon-view": expressionIconView,
  "expressions/expressions-header": expressionsHeader,
  "graphing-calc/keypads/main": keypadsMain,
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
  "expressions/expression-menus/fill": expressionMenusFill,
  "graphing/graphslayer": graphslayer,
  "main/evaluator": mainEvaluator,
  "expressions/expression-menus/expression-options-menu-view":
    expressionOptionsMenuView,
  "expressions/promptslider_view": promptSliderView,
  "main/instancehotkeys": instancehotkeys,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
