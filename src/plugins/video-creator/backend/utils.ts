import { EvaluateSingleExpression } from "utils/depUtils";

interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidNumber(s: string) {
  return !isNaN(EvaluateSingleExpression(s));
}

export function isValidLength(s: string) {
  const evaluated = EvaluateSingleExpression(s);
  return !isNaN(evaluated) && evaluated >= 2;
}

export function scaleBoundsAboutCenter(b: Bounds, r: number) {
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  return {
    left: cx + (b.left - cx) * r,
    right: cx + (b.right - cx) * r,
    top: cy + (b.top - cy) * r,
    bottom: cy + (b.bottom - cy) * r,
  };
}
