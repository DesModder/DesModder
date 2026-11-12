import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";
import { TypedConstantValue, ValueType, ValueTypeMap } from "#globals";
import { getHSVfromRGB } from "#plugins/GLesmos/colorParsing.ts";
import { ColorValueType } from "..";
import { ColorModelOptions } from "../config";
import { truncatedLatexLabel } from "../label";

type TypedConstantColorValue = TypedConstantValue<ColorValueType>;

function formatColor(
  color: ValueTypeMap[ValueType.RGBColor],
  colorModel: ColorModelOptions
): string {
  let val: number[];
  switch (colorModel) {
    case "rgb":
      val = color;
      break;
    case "hsv":
      val = getHSVfromRGB(...color);
      val[2] /= 255;
      break;
    case "hex":
      return (
        "#" +
        color
          .map((c) => c.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      );
  }
  return val.map(truncatedLatexLabel).join(",");
}

function _ColorEvaluation(
  val: TypedConstantColorValue,
  colorModel: ColorModelOptions
) {
  const { valueType, value } = val;
  const length = 6;
  let latex: string;
  if (valueType === ValueType.ListOfColor) {
    latex =
      "\\left[" +
      value
        .slice(0, length)
        .map(
          colorModel === "hex"
            ? (clist) => formatColor(clist, colorModel)
            : (clist) => `\\left(${formatColor(clist, colorModel)}\\right)`
        )
        .join(",") +
      (value.length > length
        ? `\\textcolor{gray}{...\\mathit{${value.length - length}\\ more}}`
        : "") +
      "\\right]";
  } else {
    latex = formatColor(value, colorModel);
  }

  if (colorModel !== "hex") {
    latex = `\\operatorname{${colorModel}}\\left(${latex}\\right)`;
  }

  return (
    <div class="dcg-evaluation-view__wrapped-value dsm-bev-wide-wrapped-value">
      <StaticMathQuillView latex={latex} />
    </div>
  );
}

export function ColorEvaluation(
  val: TypedConstantColorValue,
  colorModel: ColorModelOptions,
  swatch: any
) {
  return (
    <span class="dsm-color-container">
      {_ColorEvaluation(val, colorModel)}
      {swatch}
    </span>
  );
}
