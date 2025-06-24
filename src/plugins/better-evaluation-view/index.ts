import { EvaluationContainerComponent } from "#components";
import { ConstantListValueType, TypedConstantValue, ValueType } from "#globals";
import { PluginController, Replacer } from "../PluginController";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";

type EvaluableConstantValue = TypedConstantValue<
  ConstantListValueType | ValueType.RGBColor
>;

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;

  evaluation(val: () => EvaluableConstantValue | undefined): Replacer {
    const { settings } = this;
    const value = val();
    if (!value) return undefined;
    switch (value.valueType) {
      case ValueType.ListOfAngleMarker:
      case ValueType.ListOfDirectedAngleMarker:
      case ValueType.ListOfTransformation:
      case ValueType.ListOfConfidenceInterval:
      case ValueType.ListOfOneSampleTInference:
      case ValueType.ListOfTwoSampleTInference:
      case ValueType.ListOfRegressionTInference:
      case ValueType.ListOfOneSampleZInference:
      case ValueType.ListOfTwoSampleZInference:
      case ValueType.ListOfOneProportionZInference:
      case ValueType.ListOfTwoProportionZInference:
      case ValueType.ListOfZSignificanceTest:
      case ValueType.ListOfTSignificanceTest:
      case ValueType.ListOfChiSquareGoodnessOfFit:
      case ValueType.ListOfChiSquareIndependence:
        return undefined;
      case ValueType.RGBColor:
        return settings.colors
          ? (swatch) => ColorEvaluation(value, swatch)
          : undefined;
      case ValueType.ListOfColor:
        return settings.colors && settings.lists && settings.colorLists
          ? (swatch) => ColorEvaluation(value, swatch)
          : undefined;
      default:
        return settings.lists ? () => ListEvaluation(value) : undefined;
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
