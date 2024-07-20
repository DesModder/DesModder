export function rotatedPointLatex(
  x: string | number,
  y: string | number,
  ox: string | number,
  oy: string | number,
  angle: string | number
) {
  x = formatArg(x);
  y = formatArg(y);
  ox = formatArg(ox);
  oy = formatArg(oy);
  angle = formatArg(angle);

  return `\\left(${ox}+${x}\\cos ${angle}-${y}\\sin ${angle},${oy}+${y}\\cos ${angle}+${x}\\sin ${angle}\\right)`;
}

// From
// https://github.com/lafkpages/desmos-experiments/blob/734279478aaf8162c725b55cd6770480b31bb85f/src/routes/ellipse/latex.ts
export function formatArg(arg: string | number) {
  return typeof arg === "number" ? `\\left(${arg}\\right)` : arg;
}
