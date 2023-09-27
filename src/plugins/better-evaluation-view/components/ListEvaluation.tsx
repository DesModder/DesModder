import { truncatedLatexLabel } from "../../../utils/depUtils";
import { jsx } from "#DCGView";
import { StaticMathQuillView } from "#components";

export function ListEvaluation(val: () => string[]) {
  return (
    <StaticMathQuillView
      latex={() => {
        const values = val();
        const labelOptions = {
          smallCutoff: 0.00001,
          bigCutoff: 1000000,
          digits: 5,
          displayAsFraction: false,
        };
        const length = 20;
        const labels = values
          .slice(0, length)
          .map((label) => truncatedLatexLabel(label, labelOptions));
        return (
          "\\left[" +
          labels.join(",") +
          (values.length > length
            ? `\\textcolor{gray}{...\\mathit{${values.length - length}\\ more}}`
            : "") +
          "\\right]"
        );
      }}
    />
  );
}
