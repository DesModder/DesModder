import { ValueType } from "parsing/IR";
import { MaybeRational } from "parsing/parsenode";
import { Types } from "./opcodeDeps";
import getRGBPack from "./colorParsing"

export function glslFloatify(x: number) {
  return Number.isInteger(x) ? x.toString() + ".0" : x.toString();
}

export function colorVec4(color: string, opacity: number) {
  // Doesn't support css units other than % on hsl
  // it also unpacks css alpha. Which should take over? Or multiply them?
  let [r, g, b, cssAlpha] = getRGBPack(color).map(glslFloatify)
  let a = glslFloatify(opacity);
  return `vec4(${r}, ${g}, ${b}, ${a})`;
}

export function evalMaybeRational(x: MaybeRational) {
  if (typeof x === "number") {
    return x;
  } else {
    return x.n / x.d;
  }
}

export function compileObject(x: any): string {
  if (Array.isArray(x)) {
    // x is a point (a,b)
    return `vec2(${compileObject(x[0])}, ${compileObject(x[1])})`;
  }
  switch (typeof x) {
    case "boolean":
      return x ? "true" : "false";
    case "object":
      if (typeof x.n !== "number" || typeof x.d !== "number")
        throw "Not a rational";
    // ... fall through to number
    case "number":
      return glslFloatify(evalMaybeRational(x));
    case "string":
      throw "Strings not handled";
    default:
      throw `Unexpected value ${x}`;
  }
}

export function getGLType(v: ValueType) {
  switch (v) {
    case Types.Bool:
      return "boolean";
    case Types.Number:
      return "float";
    case Types.Point:
      return "vec2";
    default:
      throw `Type ${v} is not yet supported`;
  }
}
