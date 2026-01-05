import { colorVec4 } from "./outputHelpers";
import type { GLesmosShaderPackage } from "./shaders";
import type { IRExpression } from "#parsing/parsenode.ts";
import type { IRChunk } from "../../../parsing/IR";
import { ShaderFunctions } from "../../globals";

function clampParam(input: number, min: number, max: number, def: number) {
  if (isNaN(input)) return def;
  return Math.min(Math.max(input, min), max);
}

export interface EmittedGLSL {
  source: string;

  // TODO-cleanup: Record<string, boolean> can be removed once Desmos always provides joinShaderFunctions.
  shaderFunctions: Record<string, boolean> | ShaderFunctions;
  shaderUniforms: number[];
}

// Min 1024 must be supported (https://www.khronos.org/opengl/wiki/Uniform_(GLSL))
// We also have stuff like `size` and `Infinity` as uniforms, so be conservative.
const MAX_RESTRICTION_UNIFORMS = 900;

export function compileGLesmos(
  concreteTree: IRExpression,
  color: string,
  fillOpacity: number,
  lineOpacity: number,
  lineWidth: number,
  derivativeX: undefined | IRExpression,
  derivativeY: undefined | IRExpression,
  emitGLSL: (chunk: IRChunk, maxUniforms: number) => EmittedGLSL
): GLesmosShaderPackage {
  fillOpacity = clampParam(fillOpacity, 0, 1, 0.4);
  lineOpacity = clampParam(lineOpacity, 0, 1, 0.9);
  lineWidth = clampParam(lineWidth, 0, Infinity, 2.5);

  let { source, shaderFunctions, shaderUniforms } = emitGLSL(
    concreteTree._chunk,
    MAX_RESTRICTION_UNIFORMS
  );
  const shaderFunctionsList = [shaderFunctions];

  // default values for if there should be no dx, dy
  let dxsource = "return 0.0;";
  let dysource = "return 0.0;";
  let hasOutlines = false;
  if (lineWidth > 0 && lineOpacity > 0 && derivativeX && derivativeY) {
    // The counting starts over from _DCG_SC_0, so
    // nonzero uniform count would cause collisions with the above source.
    ({ source: dxsource, shaderFunctions } = emitGLSL(derivativeX._chunk, 0));
    shaderFunctionsList.push(shaderFunctions);
    ({ source: dysource, shaderFunctions } = emitGLSL(derivativeY._chunk, 0));
    shaderFunctionsList.push(shaderFunctions);
    hasOutlines = true;
  }
  return {
    hasOutlines,
    shaderFunctionsList,
    chunk: {
      main: source,
      DCG_SC_uniforms: shaderUniforms,
      dx: dxsource,
      dy: dysource,
      fill: fillOpacity > 0,
      color: colorVec4(color, fillOpacity),
      line_color: colorVec4(color, lineOpacity),
      line_width: lineWidth,
    },
  };
}
