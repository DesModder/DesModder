import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";
import { TypedConstantValue, ValueType } from "#globals";
import { ColorValueType } from "..";
import { truncatedLatexLabel } from "../label";

type TypedConstantColorValue = TypedConstantValue<ColorValueType>;

function _ColorEvaluation(val: TypedConstantColorValue) {
  return (
    <div class="dcg-evaluation-view__wrapped-value">
      <StaticMathQuillView
        latex={() => {
          const { valueType, value } = val;
          const length = 6;
          if (valueType === ValueType.ListOfColor) {
            return (
              "\\operatorname{rgb}\\left(\\left[" +
              value
                .slice(0, length)
                .map(
                  (clist) =>
                    `\\left(${clist.map(truncatedLatexLabel).join(",")}\\right)`
                )
                .join(",") +
              (value.length > length
                ? `\\textcolor{gray}{...\\mathit{${
                    value.length - length
                  }\\ more}}`
                : "") +
              "\\right]\\right)"
            );
          } else {
            return `\\operatorname{rgb}\\left(${value
              .map(truncatedLatexLabel)
              .join(",")}\\right)`;
          }
        }}
      />
    </div>
  );
}

export function ColorEvaluation(val: TypedConstantColorValue, swatch: any) {
  return (
    <span class="dsm-color-container">
      {_ColorEvaluation(val)}
      {swatch}
    </span>
  );
}
