import getRGBPack from "./colorParsing";

function glslFloatify(x: number) {
  return Number.isInteger(x)
    ? // BigInt prevents scientific notation
      BigInt(x).toString() + ".0"
    : // scientific notation is ok here. We aren't appending ".0"
      // NaN gives "NaN", defined via uniform
      // Infinity gives "Infinity", defined via uniform
      // -Infinity gives "-Infinity"
      x.toString();
}

export function colorVec4(color: string, opacity: number) {
  let r: string, g: string, b: string;
  if (color.startsWith("#") && color.length === 7) {
    r = glslFloatify(parseInt(color.slice(1, 3), 16) / 255);
    g = glslFloatify(parseInt(color.slice(3, 5), 16) / 255);
    b = glslFloatify(parseInt(color.slice(5, 7), 16) / 255);
  } else {
    /**
     * alpha from css color is neglected
     * function doesn't support css units other than % on hsl
     * but Desmos either so it doesn't affect much
     */
    [r, g, b] = getRGBPack(color).map(glslFloatify);
  }
  const a = glslFloatify(opacity);
  return `vec4(${r}, ${g}, ${b}, ${a})`;
}
