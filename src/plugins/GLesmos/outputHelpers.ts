import { ValueType } from "parsing/IR";
import { MaybeRational } from "parsing/parsenode";
import { Types } from "./opcodeDeps";
import getRGBPack from "./colorParsing";

export function glslFloatify(x: number) {
  return Number.isInteger(x) ? x.toString() + ".0" : x.toString();
}

export function colorVec4(color: string, opacity: number) {
  let r: string, g: string, b: string;
  if (color[0] === "#" && color.length === 7) {
    r = glslFloatify(parseInt(color.slice(1, 3), 16) / 256);
    g = glslFloatify(parseInt(color.slice(3, 5), 16) / 256);
    b = glslFloatify(parseInt(color.slice(5, 7), 16) / 256);
  } else {
    /**
     * alpha from css color is neglected
     * function doesn't support css units other than % on hsl
     * but Desmos either so it doesn't affect much
     */
    [r, g, b] = getRGBPack(color).map(glslFloatify);
  }
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
      return "bool";
    case Types.Number:
      return "float";
    case Types.Point:
      return "vec2";
    case Types.ListOfBool:
      return "bool[]";
    case Types.ListOfNumber:
      return "float[]";
    case Types.ListOfPoint:
      return "vec2[]";
    default:
      throw `Type ${v} is not yet supported`;
  }
}
