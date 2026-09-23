/**
 * Symbolic differentiation over Desmos's own syntax tree.
 *
 * The plain one: a tree in, a tree out, no explanation. Physics Lab has a
 * second differentiator that produces a derivation a student can read, and the
 * two are not redundant -- one is a rewrite and the other is a lesson. This is
 * the rewrite, and it is here rather than in a plugin because two things
 * outside its original home need it. Vector Tools shows a partial derivative in
 * its panel, and the integrator needs derivatives to do a substitution at all:
 * recognising that an integrand is `g(u)*u'` means knowing what `u'` is.
 *
 * It needs no computer algebra system. Desmos's parser already produces a full
 * syntax tree through `text-mode-core`'s Aug layer, differentiation of that
 * tree is mechanical, and the same layer emits LaTeX back out. The result is
 * exact for everything it accepts, and it refuses everything else rather than
 * guessing -- an almost-right derivative is worse than none.
 *
 * Every identifier other than the one being differentiated by is held constant,
 * which is exactly what makes this a *partial* derivative: differentiating
 * `2xy` by `x` treats `y` as a constant and gives `2y`.
 */
import { Aug } from "../../text-mode-core";
import { fold as simplify } from "./fold";
import {
  add,
  binop,
  call,
  dependsOn,
  divide,
  multiply,
  negative,
  number,
  power,
  subtract,
  type Node,
} from "./tree";

/** Thrown for anything this cannot differentiate exactly. */
export class SymbolicError extends Error {}

/**
 * Derivatives of the named functions, as a factor to multiply the chain-rule
 * term by. Everything here is spelled with functions Desmos itself has, so the
 * emitted derivative is ordinary vanilla LaTeX.
 */
const FUNCTION_DERIVATIVES: Record<string, (arg: Node) => Node> = {
  sin: (u) => call("cos", u),
  cos: (u) => negative(call("sin", u)),
  tan: (u) => divide(number(1), power(call("cos", u), number(2))),
  cot: (u) => negative(divide(number(1), power(call("sin", u), number(2)))),
  sec: (u) => multiply(call("sec", u), call("tan", u)),
  csc: (u) => negative(multiply(call("csc", u), call("cot", u))),
  exp: (u) => call("exp", u),
  ln: (u) => divide(number(1), u),
  log: (u) => divide(number(1), multiply(u, call("ln", number(10)))),
  sqrt: (u) => divide(number(1), multiply(number(2), call("sqrt", u))),
  arcsin: (u) =>
    divide(number(1), call("sqrt", subtract(number(1), square(u)))),
  arccos: (u) =>
    negative(divide(number(1), call("sqrt", subtract(number(1), square(u))))),
  arctan: (u) => divide(number(1), add(number(1), square(u))),
  sinh: (u) => call("cosh", u),
  cosh: (u) => call("sinh", u),
  tanh: (u) => divide(number(1), power(call("cosh", u), number(2))),
  abs: (u) => call("sign", u),
};

/**
 * The partial derivative of `node` with respect to `variable`, simplified.
 *
 * Throws {@link SymbolicError} if the expression contains anything it cannot
 * differentiate exactly, including a call to a function it does not know.
 */
export function differentiate(node: Node, variable: string): Node {
  return simplify(derivative(node, variable));
}

function derivative(node: Node, variable: string): Node {
  switch (node.type) {
    case "Constant":
      return number(0);
    case "Identifier":
      // Every other name is a constant with respect to this variable, which is
      // precisely what makes the result a partial derivative.
      return number(node.symbol === variable ? 1 : 0);
    case "Negative":
      return negative(derivative(node.arg, variable));
    case "BinaryOperator":
      return binaryDerivative(node, variable);
    case "FunctionCall":
      return functionCallDerivative(node, variable);
    default:
      throw new SymbolicError(
        `${describe(node)} cannot be differentiated symbolically.`
      );
  }
}

function binaryDerivative(node: Aug.Latex.BinaryOperator, variable: string) {
  const { left, right } = node;
  const dLeft = derivative(left, variable);
  const dRight = derivative(right, variable);
  switch (node.name) {
    case "Add":
      return add(dLeft, dRight);
    case "Subtract":
      return subtract(dLeft, dRight);
    case "Multiply":
    case "CrossMultiply":
      // Product rule.
      return add(multiply(dLeft, right), multiply(left, dRight));
    case "Divide":
      // Quotient rule.
      return divide(
        subtract(multiply(dLeft, right), multiply(left, dRight)),
        square(right)
      );
    case "Exponent":
      return exponentDerivative(left, right, dLeft, dRight, variable);
  }
}

/**
 * `u^v` splits into the two cases people actually write. A constant exponent
 * is the power rule; anything else needs the general form, which is only real
 * where `u > 0`.
 */
function exponentDerivative(
  base: Node,
  exponent: Node,
  dBase: Node,
  dExponent: Node,
  variable: string
): Node {
  if (!dependsOn(exponent, variable)) {
    return multiply(
      multiply(exponent, power(base, subtract(exponent, number(1)))),
      dBase
    );
  }
  if (!dependsOn(base, variable)) {
    // a^v: a^v * ln(a) * v'
    return multiply(
      multiply(power(base, exponent), call("ln", base)),
      dExponent
    );
  }
  // u^v: u^v * (v' ln u + v u' / u)
  return multiply(
    power(base, exponent),
    add(
      multiply(dExponent, call("ln", base)),
      divide(multiply(exponent, dBase), base)
    )
  );
}

function functionCallDerivative(
  node: Aug.Latex.FunctionCall,
  variable: string
) {
  const name = node.callee.symbol;
  if (node.args.length !== 1) {
    throw new SymbolicError(
      `${name} takes more than one argument, so it cannot be differentiated here.`
    );
  }
  const rule = FUNCTION_DERIVATIVES[name];
  if (rule === undefined) {
    throw new SymbolicError(`The derivative of ${name} is not known.`);
  }
  const [arg] = node.args;
  // Chain rule.
  return multiply(rule(arg), derivative(arg, variable));
}

/**
 * `dy/dx` for an equation that defines y implicitly, like `x^2+y^2=25`.
 *
 * This is the implicit function theorem and nothing more: for `F(x,y)=0`,
 * `dy/dx = -F_x / F_y`. Both partials are already available, so implicit
 * differentiation costs almost nothing on top of the explicit kind.
 *
 * The result is undefined wherever `F_y` is zero — the points with a vertical
 * tangent — which is a property of the curve rather than a failure here.
 */
export function implicitDerivative(
  left: Node,
  right: Node,
  independent: string,
  dependent: string
): Node {
  const f = binop("Subtract", left, right);
  return simplify(
    negative(divide(derivative(f, independent), derivative(f, dependent)))
  );
}

function describe(node: Node) {
  switch (node.type) {
    case "Integral":
      return "An integral";
    case "Derivative":
    case "Prime":
      return "A derivative";
    case "List":
    case "Range":
    case "ListComprehension":
      return "A list";
    case "Piecewise":
      return "A piecewise";
    case "RepeatedOperator":
      return "A sum or product";
    default:
      return `\`${node.type}\``;
  }
}

// ---- small builders ------------------------------------------------------

function square(node: Node) {
  return power(node, number(2));
}
