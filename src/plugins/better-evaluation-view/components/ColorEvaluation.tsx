import { jsx } from "DCGView";
import { StaticMathQuillView } from "components";

function _ColorEvaluation(val: () => string | string[]) {
  return (
    <StaticMathQuillView
      latex={() => {
        const value = val();
        const length = 6;
        if (Array.isArray(value)) {
          const color = value.map(rgb);
          return (
            "\\operatorname{rgb}\\left(\\left[" +
            color
              .slice(0, length)
              .map((clist) => `\\left(${clist.join(",")}\\right)`)
              .join(",") +
            (color.length > length
              ? `\\textcolor{gray}{...\\mathit{${
                  color.length - length
                }\\ more}}`
              : "") +
            "\\right]\\right)"
          );
        } else {
          const color = rgb(value);
          return "\\operatorname{rgb}\\left(" + color.join(",") + "\\right)";
        }
      }}
    />
  );
}

export function ColorEvaluation(val: () => string | string[], swatch: any) {
  return (
    <span class="dsm-color-container">
      {_ColorEvaluation(val)}
      {swatch}
    </span>
  );
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function rgb(hex: string) {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}
