import { formatArg } from ".";

// From
// https://github.com/lafkpages/desmos-experiments/blob/734279478aaf8162c725b55cd6770480b31bb85f/src/routes/ellipse/latex.ts
export function ellipseLatex(
  x: string | number,
  y: string | number,
  rx: string | number,
  ry: string | number,
  angle: string | number
) {
  x = formatArg(x);
  y = formatArg(y);
  rx = formatArg(rx);
  ry = formatArg(ry);
  angle = formatArg(angle);

  return `\\frac{\\left(\\left(x-${x}\\right)\\cos\\left(${angle}\\right)+\\left(y-${y}\\right)\\sin\\left(${angle}\\right)\\right)^{2}}{${rx}^{2}}+\\frac{\\left(\\left(x-${x}\\right)\\sin\\left(${angle}\\right)-\\left(y-${y}\\right)\\cos\\left(${angle}\\right)\\right)^{2}}{${ry}^{2}}<1`;
}

export const ellipseGeneratorExpressions = [
  {
    id: "shape-generator-ellipse",
    type: "expression",
    latex: ellipseLatex(
      "x_{ellipseGenerator}",
      "y_{ellipseGenerator}",
      "r_{xEllipseGenerator}",
      "r_{yEllipseGenerator}",
      "A_{ellipseGenerator}"
    ),
    color: "",
  },
  {
    id: "shape-generator-ellipse-position-x",
    type: "expression",
    latex: "x_{ellipseGenerator}=0",
    color: "",
  },
  {
    id: "shape-generator-ellipse-position-y",
    type: "expression",
    latex: "y_{ellipseGenerator}=0",
    color: "",
  },
  {
    id: "shape-generator-ellipse-radius-x",
    type: "expression",
    latex: "r_{xEllipseGenerator}=1",
    sliderBounds: { min: 0, max: "", step: "" },
    color: "",
  },
  {
    id: "shape-generator-ellipse-radius-y",
    type: "expression",
    latex: "r_{yEllipseGenerator}=1",
    sliderBounds: { min: 0, max: "", step: "" },
    color: "",
  },
  {
    id: "shape-generator-ellipse-angle",
    type: "expression",
    latex: "A_{ellipseGenerator}=0",
    sliderBounds: { min: 0, max: "\\tau", step: "" },
    color: "",
  },

  // Ensure that the expressions that will be hidden are at the bottom of the list
  {
    id: "shape-generator-ellipse-position-point",
    type: "expression",
    latex: "\\left(x_{ellipseGenerator},y_{ellipseGenerator}\\right)",
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-radius-x-point",
    type: "expression",
    latex:
      "\\left(x_{ellipseGenerator}-r_{xEllipseGenerator}\\cos A_{ellipseGenerator},y_{ellipseGenerator}-r_{xEllipseGenerator}\\sin A_{ellipseGenerator}\\right)",
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-radius-y-point-helper",
    type: "expression",
    latex:
      "f_{ellipseGeneratorRadiusYX}\\left(R_{yEllipseGenerator}\\right)=x_{ellipseGenerator}+R_{yEllipseGenerator}\\cos\\left(A_{ellipseGenerator}+\\frac{\\pi}{2}\\right)",
    hidden: true,
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-radius-y-point",
    type: "expression",
    latex:
      "\\left(f_{ellipseGeneratorRadiusYX}\\left(r_{yEllipseGenerator}\\right),y_{ellipseGenerator}+r_{yEllipseGenerator}\\sin\\left(A_{ellipseGenerator}+\\frac{\\pi}{2}\\right)\\right)",
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-angle-point-helper-x",
    type: "expression",
    latex:
      "f_{ellipseGeneratorAngleX}\\left(a_{ellipseGenerator}\\right)=x_{ellipseGenerator}+r_{xEllipseGenerator}\\cos a_{ellipseGenerator}",
    hidden: true,
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-angle-point-helper-y",
    type: "expression",
    latex:
      "f_{ellipseGeneratorAngleY}\\left(a_{ellipseGenerator}\\right)=y_{ellipseGenerator}+r_{xEllipseGenerator}\\sin a_{ellipseGenerator}",
    hidden: true,
    color: "",
    secret: true,
  },
  {
    id: "shape-generator-ellipse-angle-point",
    type: "expression",
    latex:
      "\\left(f_{ellipseGeneratorAngleX}\\left(A_{ellipseGenerator}\\right),f_{ellipseGeneratorAngleY}\\left(A_{ellipseGenerator}\\right)\\right)",
    dragMode: "X",
    color: "",
    secret: true,
  },
] satisfies Desmos.ExpressionState[];
