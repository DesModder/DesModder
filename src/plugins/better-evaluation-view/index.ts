import { EvaluationContainerComponent } from "#components";
import { ConstantListValueType, TypedConstantValue, ValueType } from "#globals";
import { PluginController, Replacer } from "../PluginController";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";

type EvaluableConstantValueType = ConstantListValueType | ValueType.RGBColor;
type EvaluableConstantValue = TypedConstantValue<EvaluableConstantValueType>;

export type NormalListValueType =
  | ValueType.ListOfComplex
  | ValueType.ListOfAny
  | ValueType.ListOfNumber
  | ValueType.ListOfBool
  | ValueType.ListOfPoint
  | ValueType.ListOfPoint3D
  | ValueType.EmptyList
  | ValueType.ListOfPolygon
  | ValueType.ListOfSegment
  | ValueType.ListOfCircle
  | ValueType.ListOfArc
  | ValueType.ListOfLine
  | ValueType.ListOfRay
  | ValueType.ListOfVector
  | ValueType.ListOfSegment3D
  | ValueType.ListOfTriangle3D
  | ValueType.ListOfSphere3D
  | ValueType.ListOfVector3D
  | ValueType.ListOfTone;

export type ColorValueType = ValueType.RGBColor | ValueType.ListOfColor;

function apiContainer() {
  return document.querySelector(".dcg-container");
}

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;

  afterEnable() {
    apiContainer()?.classList.add("dsm-better-evaluation-view");
  }

  afterDisable() {
    apiContainer()?.classList.remove("dsm-better-evaluation-view");
  }

  evaluation(val: () => EvaluableConstantValue | undefined): Replacer {
    const { settings } = this;
    const value = val();
    if (!value) return undefined;
    switch (value.valueType) {
      case ValueType.ListOfComplex:
      case ValueType.ListOfAny:
      case ValueType.ListOfNumber:
      case ValueType.ListOfBool:
      case ValueType.ListOfPoint:
      case ValueType.ListOfPoint3D:
      case ValueType.EmptyList:
      case ValueType.ListOfPolygon:
      case ValueType.ListOfSegment:
      case ValueType.ListOfCircle:
      case ValueType.ListOfArc:
      case ValueType.ListOfLine:
      case ValueType.ListOfRay:
      case ValueType.ListOfVector:
      case ValueType.ListOfSegment3D:
      case ValueType.ListOfTriangle3D:
      case ValueType.ListOfSphere3D:
      case ValueType.ListOfVector3D:
      case ValueType.ListOfTone:
        return settings.lists ? () => ListEvaluation(value) : undefined;
      case ValueType.RGBColor:
        return settings.colors
          ? (swatch) => ColorEvaluation(value, swatch)
          : undefined;
      case ValueType.ListOfColor:
        return settings.colors && settings.lists && settings.colorLists
          ? (swatch) => ColorEvaluation(value, swatch)
          : undefined;
      default:
        value.valueType satisfies Exclude<
          EvaluableConstantValueType,
          NormalListValueType | ColorValueType
        >;
        return undefined;
    }
  }

  evaluationUpdateKey(container: EvaluationContainerComponent) {
    const evaluation = this.evaluation(
      this.getTypedConstantValue.bind(container)
    );
    return !!evaluation && this.getTypedConstantValue.call(container);
  }

  getTypedConstantValue(this: EvaluationContainerComponent) {
    const model = this.controller.getItemModel(this.props.id());
    if (model?.type !== "expression") return undefined;
    return model.formula?.typed_constant_value as EvaluableConstantValue;
  }
}
