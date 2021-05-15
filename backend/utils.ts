import { EvaluateSingleExpression, Bounds } from "desmodder";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidNumber(s: string) {
  return !isNaN(EvaluateSingleExpression(s));
}

export function boundsEqual(a: Bounds, b: Bounds) {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.top === b.top &&
    a.bottom === b.bottom
  );
}
