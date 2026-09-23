/**
 * Turning a general solution into the particular one.
 *
 * Every exam question asks for this. "Find the particular solution through
 * (0, 2)" is the second half of almost every differential-equation problem, and
 * a family of curves with a slider on it is the answer to a question nobody
 * asked.
 *
 * The method is substitution rather than a new solver: put the point into the
 * solution, and what is left is one equation in C. What makes that tractable is
 * that C enters every form produced here in one of exactly three ways, and all
 * three are solvable by hand:
 *
 * - **Linearly**, which is most of them — `y = F(x) + C`, `y = A + Ce^{ax}`.
 *   Then `C = (y₀ - b)/a`.
 * - **In a denominator**, which is the logistic equation alone:
 *   `y = K/(1 + Ce^{-rx})`. The reciprocal of that *is* linear in C, so the
 *   same solve works on `1/y₀`.
 * - **As an additive constant in a relation**, for the implicit separable
 *   answers: `L(y) = R(x) + C` gives `C = L(y₀) - R(x₀)` directly.
 *
 * Nothing here searches or iterates. If C does not appear in one of those three
 * ways the condition is refused, which is the same rule the solvers follow.
 */
import { Aug, AugBuilders, type Config } from "../../../../text-mode-core";
import { linearIn } from "./integrate";
import {
  dependsOn,
  evaluate,
  fold as simplify,
  toLatex,
} from "../../../symbolic";

const { number, binop } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const divide = (a: Node, b: Node) => binop("Divide", a, b);
const subtract = (a: Node, b: Node) => binop("Subtract", a, b);

/** The constant of integration, matching what the solvers emit. */
const CONSTANT = "C";

export type InitialResult =
  | { ok: true; latex: string; value: number }
  | { ok: false; error: string };

/** What a solution has to expose for a point to be put through it. */
export interface Particularisable {
  /** The right-hand side of `y = …`, for an explicit solution. */
  tree?: Node;
  /** `left = right + C`, for one left as a relation. */
  relation?: { left: Node; right: Node };
}

/**
 * Replaces every occurrence of one identifier with a value.
 *
 * Deliberately not evaluation: the point may itself be exact — a condition at
 * `x = \pi` is perfectly ordinary — so the substituted tree stays symbolic and
 * is only turned into a number at the very end, to show alongside.
 */
export function substitute(node: Node, name: string, value: Node): Node {
  switch (node.type) {
    case "Identifier":
      return node.symbol === name ? value : node;
    case "Negative":
      return { ...node, arg: substitute(node.arg, name, value) };
    case "FunctionCall":
      return {
        ...node,
        args: node.args.map((arg) => substitute(arg, name, value)),
      };
    case "BinaryOperator":
      return {
        ...node,
        left: substitute(node.left, name, value),
        right: substitute(node.right, name, value),
      };
    default:
      return node;
  }
}

/**
 * The value of C that sends the solution through `(x₀, y₀)`.
 *
 * The three shapes are tried in the order that gives the simplest answer for
 * the equation in hand, not in order of generality.
 */
export function particularConstant(
  cfg: Config,
  solution: Particularisable,
  x0: Node,
  y0: Node,
  independent = "x",
  dependent = "y"
): InitialResult {
  const emit = (node: Node) => toLatex(cfg, node);

  if (solution.relation !== undefined) {
    // L(y) = R(x) + C, so C is simply the gap between the two sides.
    const { left, right } = solution.relation;
    const value = simplify(
      subtract(
        substitute(left, dependent, y0),
        substitute(right, independent, x0)
      )
    );
    return report(emit, value);
  }

  if (solution.tree === undefined)
    return {
      ok: false,
      error: "This solution has no point to put through it.",
    };

  const atPoint = simplify(substitute(solution.tree, independent, x0));
  if (!dependsOn(atPoint, CONSTANT)) {
    return {
      ok: false,
      error:
        "The constant drops out at that x, so no choice of it passes through that point.",
    };
  }

  // C linear: y₀ = a·C + b.
  const direct = linearIn(atPoint, CONSTANT);
  if (direct !== undefined && !isZero(direct.a)) {
    const value = simplify(divide(subtract(y0, direct.b), direct.a));
    return report(emit, value);
  }

  // C in a denominator, which is the logistic equation: 1/y₀ = a·C + b.
  const reciprocal = linearIn(simplify(divide(number(1), atPoint)), CONSTANT);
  if (reciprocal !== undefined && !isZero(reciprocal.a)) {
    const value = simplify(
      divide(subtract(divide(number(1), y0), reciprocal.b), reciprocal.a)
    );
    return report(emit, value);
  }

  return {
    ok: false,
    error:
      "The constant does not appear in a way this can solve for. It handles C on its own, and C in a denominator.",
  };
}

function report(emit: (node: Node) => string, value: Node): InitialResult {
  const numeric = evaluate(value, {});
  if (!Number.isFinite(numeric)) {
    return {
      ok: false,
      error:
        "That point gives no finite value for the constant — it may be an equilibrium the family never leaves.",
    };
  }
  return { ok: true, latex: `${CONSTANT}=${emit(value)}`, value: numeric };
}

function isZero(node: Node) {
  const simplified = simplify(node);
  return simplified.type === "Constant" && simplified.value === 0;
}

/** The identifier the solvers use, exposed so the panel can name it. */
export const CONSTANT_NAME = CONSTANT;
