import { ValueType } from "parsing/IR";
import { MaybeRational } from "parsing/parsenode";
import { Types } from "./opcodeDeps";

export function glslFloatify(x: number) {
  return Number.isInteger(x) ? x.toString() + ".0" : x.toString();
}

export function colorToVec3(color: string) {
  // assumes col is a string of the form "#FF2200"
  let r = glslFloatify(parseInt(color.slice(1, 3), 16) / 256);
  let g = glslFloatify(parseInt(color.slice(3, 5), 16) / 256);
  let b = glslFloatify(parseInt(color.slice(5, 7), 16) / 256);
  return `vec3(${r}, ${g}, ${b})`;
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
