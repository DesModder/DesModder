/**
 * Implicit multiplication that Desmos's parser could not see.
 *
 * Kept apart from `tree.ts` because it decides something: whether a name is a
 * value, which is a fact about the graph rather than about the tree, and which
 * the caller therefore has to supply.
 */
import { Aug } from "../../text-mode-core";
import { mapChildNodes, multiply, power, type Node } from "./tree";

/**
 * `x(y-1)` read as the product it is.
 *
 * Desmos's parser cannot tell a call from a product by looking, so `x(y-1)`
 * arrives as a call of a function named `x`; its evaluator decides later,
 * from what the graph defines. This is that later decision, made from the
 * names the caller knows to be values — the coordinates, and whatever the
 * expression list defines as a number. A one-argument call of one of those is
 * multiplication. Every other call is left alone, including a call of a name
 * nobody has defined: `f(x)` may be a function this cannot see, and reading
 * it as `f·x` would differentiate or integrate a function as though it were a
 * constant — a confident wrong answer where a refusal was owed.
 *
 * A power or a factorial written straight after the bracket belongs to the
 * bracket alone once the call is a product: `x(y-1)^2` is x·(y-1)², as Desmos
 * evaluates it, although the parser hands it over as (x(y-1))². Brackets the
 * user wrote around the whole call are kept by the parser as `parenWrapped`,
 * and those really do mean the square of the product.
 */
export function implicitProducts(
  node: Node,
  values: ReadonlySet<string>
): Node {
  const rewrite = (child: Node) => implicitProducts(child, values);
  const isProduct = (child: Node): child is Aug.Latex.FunctionCall =>
    child.type === "FunctionCall" &&
    child.args.length === 1 &&
    values.has(child.callee.symbol);

  if (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    isProduct(node.left) &&
    node.left.parenWrapped !== true
  )
    return multiply(
      node.left.callee,
      power(rewrite(node.left.args[0]), rewrite(node.right))
    );
  if (
    node.type === "Factorial" &&
    isProduct(node.arg) &&
    node.arg.parenWrapped !== true
  )
    return multiply(node.arg.callee, {
      ...node,
      arg: rewrite(node.arg.args[0]),
    });

  const mapped = mapChildNodes(node, rewrite);
  if (isProduct(mapped)) return multiply(mapped.callee, mapped.args[0]);
  return mapped;
}
