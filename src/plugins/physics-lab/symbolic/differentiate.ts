/**
 * Differentiation, with a record of which rule was used where.
 *
 * Vector Tools already differentiates — `symbolic.ts` does exact partials for
 * generating expressions — and this is deliberately a different thing rather
 * than a copy of it. That one answers "what is the derivative"; this one has to
 * answer "what did you do, and why there", which changes the shape of the code:
 * every rule reports itself, the dispatch has to pick the rule a course would
 * pick rather than merely a correct one, and simplification is kept separate so
 * the intermediate form is still visible.
 *
 * ## Picking the rule a person would pick
 *
 * More than one rule is technically correct almost everywhere, and choosing
 * badly produces steps that are right and unreadable. The dispatch is therefore
 * as much of the content as the rules are:
 *
 * - `3x²` is the **constant multiple** rule over the power rule, not the
 *   product rule. The product rule gives `0·x² + 3·2x`, which is correct, and
 *   nobody writes it.
 * - `x²` takes the power rule **without** the chain rule, because the chain
 *   rule's inner derivative is 1 and a step that multiplies by 1 teaches
 *   nothing. `(3x+1)²` takes both.
 * - `2^x` is the **exponential** rule, not the power rule — the variable is
 *   upstairs. `x^x` is neither, and needs logarithmic differentiation.
 * - `f/c` for constant c is a constant multiple, not a quotient; the quotient
 *   rule on it produces a squared denominator that then cancels.
 *
 * ## What it refuses
 *
 * The same rule as everywhere else in `symbolic/`: an unknown function, or a
 * call with more than one argument, stops the derivation by name rather than
 * being guessed at. A derivative that is nearly right is worse than none,
 * doubly so when it is presented as a worked example.
 */
import { Aug, AugBuilders, type Config } from "../../../../text-mode-core";
import { dependsOn, simplify } from "./integrate";
import { toLatex } from "./latex";

const { number, binop, functionCall, id, negative } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const add = (a: Node, b: Node) => binop("Add", a, b);
const subtract = (a: Node, b: Node) => binop("Subtract", a, b);
const multiply = (a: Node, b: Node) => binop("Multiply", a, b);
const divide = (a: Node, b: Node) => binop("Divide", a, b);
const power = (a: Node, b: Node) => binop("Exponent", a, b);
const call = (name: string, arg: Node) => functionCall(id(name), [arg]);
const square = (node: Node) => power(node, number(2));

/** Thrown for anything this cannot differentiate exactly. */
export class DifferentiationError extends Error {}

export type RuleName =
  | "constant"
  | "identity"
  | "constant-multiple"
  | "power"
  | "sum"
  | "difference"
  | "product"
  | "quotient"
  | "chain"
  | "exponential"
  | "exponential-base"
  | "logarithm"
  | "trigonometric"
  | "inverse-trigonometric"
  | "hyperbolic"
  | "root"
  | "absolute"
  | "logarithmic-differentiation";

export interface Step {
  rule: RuleName;
  /** The rule's name, as a course names it. */
  title: string;
  /** What to do, written in terms of this expression. */
  detail: string;
  /** The expression this step differentiates. */
  before: Node;
  /** What the rule produces, before any simplification. */
  after: Node;
  /** Depth in the expression tree, so sub-derivations can be indented. */
  depth: number;
}

export interface Derivation {
  /** The derivative, simplified. */
  result: Node;
  /** The derivative exactly as the rules produced it. */
  raw: Node;
  steps: readonly Step[];
}

/**
 * Derivatives of the named functions, as the factor the chain rule multiplies.
 *
 * Every one is spelled with a function Desmos itself has — checked against its
 * own operator-name list — so a derivative can go straight into the expression
 * list.
 */
interface FunctionRule {
  rule: RuleName;
  title: string;
  derivative: (u: Node) => Node;
  /** Said about the outer function, with `u` standing for its argument. */
  says: string;
}

const FUNCTION_RULES: Record<string, FunctionRule> = {
  sin: rule(
    "trigonometric",
    "Derivative of sine",
    (u) => call("cos", u),
    "sin(u) differentiates to cos(u)"
  ),
  cos: rule(
    "trigonometric",
    "Derivative of cosine",
    (u) => negative(call("sin", u)),
    "cos(u) differentiates to -sin(u)"
  ),
  tan: rule(
    "trigonometric",
    "Derivative of tangent",
    (u) => square(call("sec", u)),
    "tan(u) differentiates to sec²(u)"
  ),
  cot: rule(
    "trigonometric",
    "Derivative of cotangent",
    (u) => negative(square(call("csc", u))),
    "cot(u) differentiates to -csc²(u)"
  ),
  sec: rule(
    "trigonometric",
    "Derivative of secant",
    (u) => multiply(call("sec", u), call("tan", u)),
    "sec(u) differentiates to sec(u)tan(u)"
  ),
  csc: rule(
    "trigonometric",
    "Derivative of cosecant",
    (u) => negative(multiply(call("csc", u), call("cot", u))),
    "csc(u) differentiates to -csc(u)cot(u)"
  ),

  arcsin: rule(
    "inverse-trigonometric",
    "Derivative of arcsine",
    (u) => divide(number(1), call("sqrt", subtract(number(1), square(u)))),
    "arcsin(u) differentiates to 1/√(1-u²)"
  ),
  arccos: rule(
    "inverse-trigonometric",
    "Derivative of arccosine",
    (u) =>
      negative(divide(number(1), call("sqrt", subtract(number(1), square(u))))),
    "arccos(u) differentiates to -1/√(1-u²)"
  ),
  arctan: rule(
    "inverse-trigonometric",
    "Derivative of arctangent",
    (u) => divide(number(1), add(number(1), square(u))),
    "arctan(u) differentiates to 1/(1+u²)"
  ),
  arccot: rule(
    "inverse-trigonometric",
    "Derivative of arccotangent",
    (u) => negative(divide(number(1), add(number(1), square(u)))),
    "arccot(u) differentiates to -1/(1+u²)"
  ),
  arcsec: rule(
    "inverse-trigonometric",
    "Derivative of arcsecant",
    (u) =>
      divide(
        number(1),
        multiply(call("abs", u), call("sqrt", subtract(square(u), number(1))))
      ),
    "arcsec(u) differentiates to 1/(|u|√(u²-1))"
  ),
  arccsc: rule(
    "inverse-trigonometric",
    "Derivative of arccosecant",
    (u) =>
      negative(
        divide(
          number(1),
          multiply(call("abs", u), call("sqrt", subtract(square(u), number(1))))
        )
      ),
    "arccsc(u) differentiates to -1/(|u|√(u²-1))"
  ),

  sinh: rule(
    "hyperbolic",
    "Derivative of hyperbolic sine",
    (u) => call("cosh", u),
    "sinh(u) differentiates to cosh(u)"
  ),
  cosh: rule(
    "hyperbolic",
    "Derivative of hyperbolic cosine",
    (u) => call("sinh", u),
    "cosh(u) differentiates to sinh(u)"
  ),
  tanh: rule(
    "hyperbolic",
    "Derivative of hyperbolic tangent",
    (u) => square(call("sech", u)),
    "tanh(u) differentiates to sech²(u)"
  ),
  coth: rule(
    "hyperbolic",
    "Derivative of hyperbolic cotangent",
    (u) => negative(square(call("csch", u))),
    "coth(u) differentiates to -csch²(u)"
  ),
  sech: rule(
    "hyperbolic",
    "Derivative of hyperbolic secant",
    (u) => negative(multiply(call("sech", u), call("tanh", u))),
    "sech(u) differentiates to -sech(u)tanh(u)"
  ),
  csch: rule(
    "hyperbolic",
    "Derivative of hyperbolic cosecant",
    (u) => negative(multiply(call("csch", u), call("coth", u))),
    "csch(u) differentiates to -csch(u)coth(u)"
  ),

  arcsinh: rule(
    "inverse-trigonometric",
    "Derivative of inverse hyperbolic sine",
    (u) => divide(number(1), call("sqrt", add(square(u), number(1)))),
    "arcsinh(u) differentiates to 1/√(u²+1)"
  ),
  arccosh: rule(
    "inverse-trigonometric",
    "Derivative of inverse hyperbolic cosine",
    (u) => divide(number(1), call("sqrt", subtract(square(u), number(1)))),
    "arccosh(u) differentiates to 1/√(u²-1)"
  ),
  arctanh: rule(
    "inverse-trigonometric",
    "Derivative of inverse hyperbolic tangent",
    (u) => divide(number(1), subtract(number(1), square(u))),
    "arctanh(u) differentiates to 1/(1-u²)"
  ),

  exp: rule(
    "exponential",
    "Derivative of the exponential",
    (u) => call("exp", u),
    "exp(u) differentiates to itself"
  ),
  ln: rule(
    "logarithm",
    "Derivative of the natural logarithm",
    (u) => divide(number(1), u),
    "ln(u) differentiates to 1/u"
  ),
  log: rule(
    "logarithm",
    "Derivative of the base-10 logarithm",
    (u) => divide(number(1), multiply(u, call("ln", number(10)))),
    "log(u) differentiates to 1/(u ln 10)"
  ),
  sqrt: rule(
    "root",
    "Derivative of the square root",
    (u) => divide(number(1), multiply(number(2), call("sqrt", u))),
    "√u differentiates to 1/(2√u)"
  ),
  abs: rule(
    "absolute",
    "Derivative of absolute value",
    (u) => call("sign", u),
    "|u| differentiates to sign(u), undefined where u is 0"
  ),
};

function rule(
  name: RuleName,
  title: string,
  derivative: (u: Node) => Node,
  says: string
): FunctionRule {
  return { rule: name, title, derivative, says };
}

/**
 * The derivative of `node` with respect to `variable`, with the steps taken.
 *
 * `cfg` is needed because the steps say what was done in terms of the actual
 * sub-expressions, and saying that means emitting them.
 */
export function differentiate(
  cfg: Config,
  node: Node,
  variable: string
): Derivation {
  const steps: Step[] = [];
  const raw = derive(cfg, node, variable, 0, steps);
  return { result: simplify(raw), raw, steps };
}

function derive(
  cfg: Config,
  node: Node,
  variable: string,
  depth: number,
  steps: Step[]
): Node {
  const show = (value: Node) => toLatex(cfg, value);
  const record = (
    name: RuleName,
    title: string,
    detail: string,
    after: Node
  ) => {
    steps.push({ rule: name, title, detail, before: node, after, depth });
    return after;
  };

  // Anything without the variable in it is a constant, whatever it is made of.
  if (!dependsOn(node, variable)) {
    return record(
      "constant",
      "Constant rule",
      `${show(node)} does not contain ${variable}, so its derivative is 0.`,
      number(0)
    );
  }

  switch (node.type) {
    case "Identifier":
      return record(
        "identity",
        "Derivative of the variable",
        `The derivative of ${variable} with respect to itself is 1.`,
        number(1)
      );

    case "Negative": {
      const inner = derive(cfg, node.arg, variable, depth + 1, steps);
      return record(
        "constant-multiple",
        "Constant multiple rule",
        `The minus sign is a factor of -1 and comes along unchanged.`,
        negative(inner)
      );
    }

    case "BinaryOperator":
      return binaryRule(cfg, node, variable, depth, steps, record, show);

    case "FunctionCall":
      return functionCallRule(cfg, node, variable, depth, steps, record, show);

    default:
      throw new DifferentiationError(
        `${describe(node)} cannot be differentiated here.`
      );
  }
}

type Record_ = (
  name: RuleName,
  title: string,
  detail: string,
  after: Node
) => Node;

function binaryRule(
  cfg: Config,
  node: Aug.Latex.BinaryOperator,
  variable: string,
  depth: number,
  steps: Step[],
  record: Record_,
  show: (n: Node) => string
): Node {
  const { left, right } = node;
  const leftHas = dependsOn(left, variable);
  const rightHas = dependsOn(right, variable);

  switch (node.name) {
    case "Add":
    case "Subtract": {
      const isSum = node.name === "Add";
      const dLeft = derive(cfg, left, variable, depth + 1, steps);
      const dRight = derive(cfg, right, variable, depth + 1, steps);
      return record(
        isSum ? "sum" : "difference",
        isSum ? "Sum rule" : "Difference rule",
        `Differentiate each term separately and ${isSum ? "add" : "subtract"} the results.`,
        isSum ? add(dLeft, dRight) : subtract(dLeft, dRight)
      );
    }

    case "Multiply":
    case "CrossMultiply": {
      // A factor without the variable is a coefficient, not a second function.
      // The product rule here is correct and produces a zero term nobody writes.
      if (!leftHas || !rightHas) {
        const [constant, varying] = leftHas ? [right, left] : [left, right];
        const inner = derive(cfg, varying, variable, depth + 1, steps);
        return record(
          "constant-multiple",
          "Constant multiple rule",
          `${show(constant)} is a constant factor, so it stays put and only ${show(varying)} is differentiated.`,
          multiply(constant, inner)
        );
      }
      const dLeft = derive(cfg, left, variable, depth + 1, steps);
      const dRight = derive(cfg, right, variable, depth + 1, steps);
      return record(
        "product",
        "Product rule",
        `With u = ${show(left)} and v = ${show(right)}, (uv)' = u'v + uv'.`,
        add(multiply(dLeft, right), multiply(left, dRight))
      );
    }

    case "Divide": {
      // Dividing by a constant is multiplying by its reciprocal. The quotient
      // rule would square that constant and then cancel it again.
      if (!rightHas) {
        const inner = derive(cfg, left, variable, depth + 1, steps);
        return record(
          "constant-multiple",
          "Constant multiple rule",
          `${show(right)} is a constant denominator, so it divides the derivative of ${show(left)}.`,
          divide(inner, right)
        );
      }
      const dLeft = derive(cfg, left, variable, depth + 1, steps);
      const dRight = derive(cfg, right, variable, depth + 1, steps);
      return record(
        "quotient",
        "Quotient rule",
        `With u = ${show(left)} and v = ${show(right)}, (u/v)' = (u'v - uv')/v².`,
        divide(
          subtract(multiply(dLeft, right), multiply(left, dRight)),
          square(right)
        )
      );
    }

    case "Exponent":
      return exponentRule(
        cfg,
        left,
        right,
        variable,
        depth,
        steps,
        record,
        show
      );
  }
}

/**
 * The three genuinely different cases of `u^v`, and they are not variations on
 * one rule: which of them applies depends entirely on where the variable is.
 */
function exponentRule(
  cfg: Config,
  base: Node,
  exponent: Node,
  variable: string,
  depth: number,
  steps: Step[],
  record: Record_,
  show: (n: Node) => string
): Node {
  const baseHas = dependsOn(base, variable);
  const exponentHas = dependsOn(exponent, variable);

  if (baseHas && !exponentHas) {
    const lowered = simplify(subtract(exponent, number(1)));
    const outer = multiply(exponent, power(base, lowered));
    // The chain rule's inner derivative is 1 when the base is the bare
    // variable, and a step that multiplies by 1 is noise.
    if (isVariable(base, variable)) {
      return record(
        "power",
        "Power rule",
        `Bring the exponent down and reduce it by one: ${variable}^${show(exponent)} becomes ${show(exponent)}·${variable}^${show(lowered)}.`,
        outer
      );
    }
    const inner = derive(cfg, base, variable, depth + 1, steps);
    return record(
      "power",
      "Power rule with the chain rule",
      `The base ${show(base)} is not just ${variable}, so after the power rule multiply by its derivative.`,
      multiply(outer, inner)
    );
  }

  if (!baseHas && exponentHas) {
    const isE = base.type === "Identifier" && base.symbol === "e";
    const outer = isE
      ? power(base, exponent)
      : multiply(power(base, exponent), call("ln", base));
    if (isVariable(exponent, variable)) {
      return record(
        isE ? "exponential" : "exponential-base",
        isE ? "Derivative of e^x" : "Derivative of a^x",
        isE
          ? `e^${variable} is its own derivative.`
          : `a^${variable} differentiates to a^${variable}·ln a, here with a = ${show(base)}.`,
        outer
      );
    }
    const inner = derive(cfg, exponent, variable, depth + 1, steps);
    return record(
      isE ? "exponential" : "exponential-base",
      "Exponential rule with the chain rule",
      `The variable is in the exponent, so differentiate the exponent and multiply.`,
      multiply(outer, inner)
    );
  }

  // The variable is in both places, so neither the power rule nor the
  // exponential rule applies: u^v = e^{v ln u} is the only way through.
  const dBase = derive(cfg, base, variable, depth + 1, steps);
  const dExponent = derive(cfg, exponent, variable, depth + 1, steps);
  return record(
    "logarithmic-differentiation",
    "Logarithmic differentiation",
    `${variable} appears in both the base and the exponent, so neither the power rule nor the exponential rule applies. Writing u^v as e^{v ln u} gives u^v(v' ln u + v u'/u).`,
    multiply(
      power(base, exponent),
      add(
        multiply(dExponent, call("ln", base)),
        divide(multiply(exponent, dBase), base)
      )
    )
  );
}

function functionCallRule(
  cfg: Config,
  node: Aug.Latex.FunctionCall,
  variable: string,
  depth: number,
  steps: Step[],
  record: Record_,
  show: (n: Node) => string
): Node {
  const name = node.callee.symbol;
  if (node.args.length !== 1) {
    throw new DifferentiationError(
      `${name} takes more than one argument, so it cannot be differentiated here.`
    );
  }
  const known = FUNCTION_RULES[name];
  if (known === undefined) {
    throw new DifferentiationError(`The derivative of ${name} is not known.`);
  }
  const [argument] = node.args;
  const outer = known.derivative(argument);

  // A bare variable inside means the chain rule contributes a factor of 1.
  if (isVariable(argument, variable)) {
    return record(known.rule, known.title, `${known.says}.`, outer);
  }
  const inner = derive(cfg, argument, variable, depth + 1, steps);
  return record(
    "chain",
    "Chain rule",
    `${known.says}. The inside is ${show(argument)} rather than ${variable}, so multiply by its derivative.`,
    multiply(outer, inner)
  );
}

function isVariable(node: Node, variable: string) {
  return node.type === "Identifier" && node.symbol === variable;
}

/**
 * `dy/dx` for a curve given implicitly, by the implicit function theorem.
 *
 * `F(x, y) = 0` has `dy/dx = -F_x / F_y`, which costs two partial derivatives
 * and no new machinery: holding every other name constant is already what the
 * constant rule does. Undefined where `F_y` is zero, which is the vertical
 * tangents, and that is a fact about the curve rather than a failure here.
 */
export function implicitDerivative(
  cfg: Config,
  left: Node,
  right: Node,
  independent: string,
  dependent: string
): Derivation {
  const f = subtract(left, right);
  const steps: Step[] = [];
  const partialX = derive(cfg, f, independent, 1, steps);
  const partialY = derive(cfg, f, dependent, 1, steps);
  const raw = negative(divide(partialX, partialY));
  steps.push({
    rule: "quotient",
    title: "Implicit differentiation",
    detail: `Move everything to one side as F = ${toLatex(cfg, f)}, then d${dependent}/d${independent} = -F_${independent}/F_${dependent}.`,
    before: f,
    after: raw,
    depth: 0,
  });
  return { result: simplify(raw), raw, steps };
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
