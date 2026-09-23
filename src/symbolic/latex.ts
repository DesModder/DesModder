/**
 * Emitting a tree as the LaTeX a person would have written.
 *
 * The Aug emitter is correct and literal, which is the right default for a
 * round trip and the wrong one for an answer somebody reads. Three differences
 * matter enough to fix, and all are applied only to trees the symbolic layer
 * built — never to anything the user typed.
 *
 * `\cdot` before a name is dropped, so a solution reads `2y` rather than
 * `2\cdot y`. That is safe because juxtaposition means multiplication and nothing
 * else before a letter or a command. The dot stays before a digit, where
 * `2\cdot 3` must not become `23`.
 *
 * Absolute value is written with bars. Aug has no node for `|x|`, so it leaves
 * the emitter as `\operatorname{abs}\left(x\right)` — which Desmos does parse,
 * and which nobody writing `∫dx/x = ln|x| + C` would recognise as the answer to
 * their question. Every logarithm this plugin produces has one inside it.
 *
 * And the parentheses a function call puts around an argument that is already
 * delimited are removed, so that comes out as `\ln|x|` rather than `\ln(|x|)`.
 *
 * Every one of these walks `\left`/`\right` pairs rather than matching a
 * regular expression. The naive version breaks the moment an argument contains
 * a bracket of its own — `abs(f(x))` would close at f's bracket and leave the
 * rest of the expression outside the bars, producing something that still
 * parses and quietly means something else.
 */
import { Aug, latexTreeToString, type Config } from "../../text-mode-core";

type Node = Aug.Latex.AnyChild;

const LEFT = "\\left";
const RIGHT = "\\right";

/**
 * The index of the `\right` matching a `\left` whose delimiter ends at `from`,
 * or -1 if the string is unbalanced.
 */
function matchingRight(latex: string, from: number): number {
  let depth = 1;
  let cursor = from;
  while (cursor < latex.length) {
    if (latex.startsWith(LEFT, cursor)) {
      depth += 1;
      cursor += LEFT.length;
    } else if (latex.startsWith(RIGHT, cursor)) {
      depth -= 1;
      if (depth === 0) return cursor;
      cursor += RIGHT.length;
    } else {
      cursor += 1;
    }
  }
  return -1;
}

const ABS_OPEN = `\\operatorname{abs}${LEFT}(`;

/** Rewrites `\operatorname{abs}\left(…\right)` as `\left|…\right|`. */
export function absToBars(latex: string): string {
  let result = latex;
  let index = result.indexOf(ABS_OPEN);
  while (index >= 0) {
    const start = index + ABS_OPEN.length;
    const close = matchingRight(result, start);
    // An unbalanced string is left exactly as it is: a half-applied conversion
    // is worse than the verbose form it was meant to replace.
    if (close < 0) return result;
    const inner = result.slice(start, close);
    result =
      result.slice(0, index) +
      `${LEFT}|${inner}${RIGHT}|` +
      result.slice(close + RIGHT.length + 1);
    index = result.indexOf(ABS_OPEN, index);
  }
  return result;
}

/**
 * Drops `\left(…\right)` whose entire content is one already-delimited group,
 * which is what a function call puts around an absolute value.
 */
export function dropRedundantParens(latex: string): string {
  let result = latex;
  let index = result.indexOf(`${LEFT}(${LEFT}|`);
  while (index >= 0) {
    const innerStart = index + LEFT.length + 1;
    const outerClose = matchingRight(result, innerStart);
    const innerClose = matchingRight(result, innerStart + LEFT.length + 1);
    // Only when the inner group is the whole of the outer one. `(|a|+1)` has
    // its parens for a reason and must keep them.
    if (
      outerClose < 0 ||
      innerClose < 0 ||
      innerClose + RIGHT.length + 1 !== outerClose
    ) {
      index = result.indexOf(`${LEFT}(${LEFT}|`, index + 1);
      continue;
    }
    result =
      result.slice(0, index) +
      result.slice(innerStart, outerClose) +
      result.slice(outerClose + RIGHT.length + 1);
    index = result.indexOf(`${LEFT}(${LEFT}|`);
  }
  return result;
}

/** A tree as readable Desmos LaTeX. */
export function toLatex(cfg: Config, node: Node): string {
  return dropRedundantParens(
    absToBars(
      latexTreeToString(cfg, node).replace(/\\cdot (?=[A-Za-z\\])/g, "")
    )
  );
}
