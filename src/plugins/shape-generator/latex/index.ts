// From
// https://github.com/lafkpages/desmos-experiments/blob/734279478aaf8162c725b55cd6770480b31bb85f/src/routes/ellipse/latex.ts
export function formatArg(arg: string | number) {
  return typeof arg === "number" ? `\\left(${arg}\\right)` : arg;
}
