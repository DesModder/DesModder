import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";
import { Private, TypedConstantValue, ValueType } from "#globals";

export function ListEvaluation(
  val: () => TypedConstantValue<
    | ValueType.EmptyList
    | ValueType.ListOfNumber
    | ValueType.ListOfComplex
    | ValueType.ListOfPoint
    | ValueType.ListOfPoint3D
  >
) {
  return (
    <div class="dcg-evaluation-view__wrapped-value">
      <StaticMathQuillView
        latex={() => {
          const typedConstantValue = val();
          const labelOptions = {
            smallCutoff: 0.00001,
            bigCutoff: 1000000,
            digits: 5,
            displayAsFraction: false,
          };
          const formatLabel = (() => {
            switch (typedConstantValue.valueType) {
              case ValueType.ListOfComplex:
                return Private.Mathtools.Label.complexNumberLabel;
              case ValueType.ListOfPoint:
                return Private.Mathtools.Label.pointLabel;
              case ValueType.ListOfPoint3D:
                return Private.Mathtools.Label.point3dLabel;
              default:
                return Private.Mathtools.Label.truncatedLatexLabel;
            }
          })();
          const listLength = typedConstantValue.value.length;
          const truncationLength = 20;
          const labels = typedConstantValue.value
            .slice(0, truncationLength)
            .map((label) => {
              const latex = formatLabel(label, labelOptions);
              if (latex === "undefined") return "\\mathrm{undefined}";
              return latex;
            });
          return (
            "\\left[" +
            labels.join(",") +
            (listLength > truncationLength
              ? `\\textcolor{gray}{...\\mathit{${
                  listLength - truncationLength
                }\\ more}}`
              : "") +
            "\\right]"
          );
        }}
      />
    </div>
  );
}
