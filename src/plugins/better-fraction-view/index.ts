import { ValueType } from "#globals";
import { PluginController } from "../PluginController";

export default class BetterFractionView extends PluginController {
  static id = "better-fraction-view" as const;
  static enabledByDefault = true;

  canDisplayEvaluationForItemAsFraction(
    o: { valueType: ValueType; value: unknown } | undefined,
    canDisplayAsFraction: (c: number) => boolean
  ) {
    switch (o?.valueType) {
      case ValueType.ListOfNumber:
        return (o.value as number[]).some((e) => canDisplayAsFraction(e));
      case ValueType.Matrix:
        return (o.value as number[][]).some((row) =>
          row.some((e) => canDisplayAsFraction(e))
        );
      default:
        return false;
    }
  }
}
