import { desmosRequire, Calc } from "globals/window";
export const jquery = desmosRequire("jquery");
export const keys = desmosRequire("keys");
const _EvaluateSingleExpression = desmosRequire(
  "core/math/evaluate-single-expression"
).default;
const _DataHelpers = desmosRequire(
  "main/data_helpers"
);

export function EvaluateSingleExpression(s: string): number {
  // may also return NaN (which is a number)
  return _EvaluateSingleExpression(s, Calc.controller.isDegreeMode());
}

export function TableParse(s: string): Array<string> | undefined{
  return _DataHelpers.parse(s);
}

interface FuncAny {
  (): any;
}

function _pollForValue<T>(func: () => T) {
  return new Promise<T>((resolve) => {
    const interval = setInterval(() => {
      const val = func();
      if (val !== null && val !== undefined) {
        clearInterval(interval);
        resolve(val);
      }
    }, 50);
  });
}

export async function pollForValue(func: FuncAny) {
  return await _pollForValue(func);
}

interface ClassDict {
  [key: string]: boolean;
}

export type MaybeClassDict = string | ClassDict | undefined | null;

function updateClass(out: ClassDict, c: MaybeClassDict) {
  // mutates `out`, returns nothing
  if (c == null) {
    // no change
  } else if (typeof c === "string") {
    for (const cls of c.split(" ")) {
      out[cls] = true;
    }
  } else {
    Object.assign(out, c);
  }
}

export function mergeClass(c1: MaybeClassDict, c2: MaybeClassDict) {
  const out: ClassDict = {};
  updateClass(out, c1);
  updateClass(out, c2);
  return out;
}

// https://dev.to/_gdelgado/implement-a-type-safe-version-of-node-s-promisify-in-7-lines-of-code-in-typescript-2j34
export const promisify =
  <T, A>(
    fn: (args: T, cb: (args: A) => void) => void
  ): ((args: T) => Promise<A>) =>
  (args: T) =>
    new Promise((resolve) => {
      fn(args, (callbackArgs) => {
        resolve(callbackArgs);
      });
    });
