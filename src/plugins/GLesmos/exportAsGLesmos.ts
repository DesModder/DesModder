import { colorVec4 } from "./outputHelpers";
import { GLesmosShaderPackage } from "./shaders";
import { ParsenodeError } from "./workerDeps";
import { IRExpression } from "#parsing/parsenode.ts";
import { IRChunk } from "../../../parsing/IR";

function clampParam(input: number, min: number, max: number, def: number) {
  if (isNaN(input)) return def;
  return Math.min(Math.max(input, min), max);
}

export interface EmittedGLSL {
  source: string;
  shaderFunctions: Record<string, boolean>;
}

export function compileGLesmos(
  concreteTree: IRExpression,
  color: string,
  fillOpacity: number,
  lineOpacity: number,
  lineWidth: number,
  derivativeX: undefined | IRExpression,
  derivativeY: undefined | IRExpression,
  emitGLSL: (chunk: IRChunk) => EmittedGLSL
): GLesmosShaderPackage {
  try {
    fillOpacity = clampParam(fillOpacity, 0, 1, 0.4);
    lineOpacity = clampParam(lineOpacity, 0, 1, 0.9);
    lineWidth = clampParam(lineWidth, 0, Infinity, 2.5);

    let { source, shaderFunctions } = emitGLSL(concreteTree._chunk);
    let deps = shaderFunctions;

    // default values for if there should be no dx, dy
    let dxsource = "return 0.0;";
    let dysource = "return 0.0;";
    let hasOutlines = false;
    if (lineWidth > 0 && lineOpacity > 0 && derivativeX && derivativeY) {
      ({ source: dxsource, shaderFunctions } = emitGLSL(derivativeX._chunk));
      deps = { ...deps, ...shaderFunctions };
      ({ source: dysource, shaderFunctions } = emitGLSL(derivativeY._chunk));
      deps = { ...deps, ...shaderFunctions };
      hasOutlines = true;
    }
    return {
      hasOutlines,
      deps,
      chunks: [
        {
          main: source,
          dx: dxsource,
          dy: dysource,
          fill: fillOpacity > 0,
          color: `${colorVec4(color, fillOpacity)}`,
          line_color: `${colorVec4(color, lineOpacity)}`,
          line_width: lineWidth,
        },
      ],
    };
  } catch (msg) {
    throw new ParsenodeError(`[GLesmos Error] ${msg}`);
  }
}
