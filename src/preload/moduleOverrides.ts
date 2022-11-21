import abstractItem from "./moduleOverrides/abstract-item";
import abstractItemView from "./moduleOverrides/abstract-item-view";
import actionsKeyboard from "./moduleOverrides/actions__keyboard";
import expressionEditActions from "./moduleOverrides/expression-edit-actions";
import expressionIconView from "./moduleOverrides/expression-icon-view";
import expressionMenusFill from "./moduleOverrides/expression-menus__fill";
import expressionOptionsMenuView from "./moduleOverrides/expression-options-menu-view";
import expressionView from "./moduleOverrides/expression_view";
import expressionsHeader from "./moduleOverrides/expressions-header";
import folderView from "./moduleOverrides/folder-view";
import genericView from "./moduleOverrides/generic-view";
import graphslayer from "./moduleOverrides/graphslayer";
import instancehotkeys from "./moduleOverrides/instancehotkeys";
import keypadsMain from "./moduleOverrides/keypads__main";
import listView from "./moduleOverrides/list-view";
import calcDesktop from "./moduleOverrides/main__calc_desktop";
import mainController from "./moduleOverrides/main__controller";
import mainEvaluator from "./moduleOverrides/main__evaluator";
import promptSliderView from "./moduleOverrides/promptslider_view";
import smartTextarea from "./moduleOverrides/smart_textarea";
import workerSrcUnderlying from "./moduleOverrides/text__worker_src_underlying";
import tooltippedError from "./moduleOverrides/tooltipped-error";
import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
  "main/calc_desktop": calcDesktop,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
