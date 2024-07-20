import { formatArg, rotatedPointLatex } from ".";

export function rectanglePoints(
  w: string | number,
  h: string | number,
  x: string | number,
  y: string | number,
  angle: string | number
) {
  w = formatArg(w);
  h = formatArg(h);
  x = formatArg(x);
  y = formatArg(y);
  angle = formatArg(angle);

  const nw = `-${w}`;
  const nh = `-${h}`;

  return [
    [w, h],
    [nw, h],
    [nw, nh],
    [w, nh],
  ];
}

export function rectangleLatexGivenPointsLatex(pointsLatex: string) {
  return `\\operatorname{polygon}\\left(${pointsLatex}\\right)`;
}

export function rectangleLatex(
  w: string | number,
  h: string | number,
  x: string | number,
  y: string | number,
  angle: string | number
) {
  return rectangleLatexGivenPointsLatex(
    rectanglePoints(w, h, x, y, angle)
      .map(([px, py]) => rotatedPointLatex(px, py, x, y, angle))
      .join(",")
  );
}

export const rectangleGeneratorExpressions = [
  {
    id: "shape-generator-rectangle",
    type: "expression",
    latex: rectangleLatex(
      "w_{rectangleGenerator}",
      "h_{rectangleGenerator}",
      "x_{rectangleGenerator}",
      "y_{rectangleGenerator}",
      "A_{rectangleGenerator}"
    ),
  },
  {
    id: "shape-generator-rectangle-position-point",
    type: "expression",
    latex: "\\left(x_{rectangleGenerator},y_{rectangleGenerator}\\right)",
  },
  {
    id: "shape-generator-rectangle-position-x",
    type: "expression",
    latex: "x_{rectangleGenerator}=0",
  },
  {
    id: "shape-generator-rectangle-position-y",
    type: "expression",
    latex: "y_{rectangleGenerator}=0",
  },
  {
    id: "shape-generator-rectangle-width-point",
    type: "expression",
    latex:
      "\\left(f_{rectangleGeneratorWidthX}\\left(w_{rectangleGenerator}\\right),y_{rectangleGenerator}+w_{rectangleGenerator}\\sin A_{rectangleGenerator}\\right)",
  },
  {
    id: "shape-generator-rectangle-width-x-helper",
    type: "expression",
    latex:
      "f_{rectangleGeneratorWidthX}\\left(W_{rectangleGenerator}\\right)=x_{rectangleGenerator}+W_{rectangleGenerator}\\cos A_{rectangleGenerator}",
    hidden: true,
  },
  {
    id: "shape-generator-rectangle-height-point",
    type: "expression",
    latex:
      "\\left(f_{rectangleGeneratorHeightX}\\left(h_{rectangleGenerator}\\right),y_{rectangleGenerator}+h_{rectangleGenerator}\\cos A_{rectangleGenerator}\\right)",
  },
  {
    id: "shape-generator-rectangle-height-x-helper",
    type: "expression",
    latex:
      "f_{rectangleGeneratorHeightX}\\left(H_{rectangleGenerator}\\right)=x_{rectangleGenerator}-H_{rectangleGenerator}\\sin A_{rectangleGenerator}",
    hidden: true,
  },
  {
    id: "shape-generator-rectangle-width",
    type: "expression",
    latex: "w_{rectangleGenerator}=1",
    sliderBounds: { min: 0, max: "", step: "" },
  },
  {
    id: "shape-generator-rectangle-height",
    type: "expression",
    latex: "h_{rectangleGenerator}=1",
    sliderBounds: { min: 0, max: "", step: "" },
  },
  {
    id: "shape-generator-rectangle-angle-point",
    type: "expression",
    latex:
      "\\left(f_{rectangleGeneratorAngleX}\\left(A_{rectangleGenerator}\\right),f_{rectangleGeneratorAngleY}\\left(A_{rectangleGenerator}\\right)\\right)",
    dragMode: "X",
  },
  {
    id: "shape-generator-rectangle-angle-point-x-helper",
    type: "expression",
    latex:
      "f_{rectangleGeneratorAngleX}\\left(a_{rectangleGenerator}\\right)=x_{rectangleGenerator}+w_{rectangleGenerator}\\cos a_{rectangleGenerator}-h_{rectangleGenerator}\\sin a_{rectangleGenerator}",
    hidden: true,
  },
  {
    id: "shape-generator-rectangle-angle-point-y-helper",
    type: "expression",
    latex:
      "f_{rectangleGeneratorAngleY}\\left(a_{rectangleGenerator}\\right)=y_{rectangleGenerator}+h_{rectangleGenerator}\\cos a_{rectangleGenerator}+w_{rectangleGenerator}\\sin a_{rectangleGenerator}",
    hidden: true,
  },
  {
    id: "shape-generator-rectangle-angle",
    type: "expression",
    latex: "A_{rectangleGenerator}=0",
    sliderBounds: { min: 0, max: "\\tau", step: "" },
  },
] satisfies Desmos.ExpressionState[];
