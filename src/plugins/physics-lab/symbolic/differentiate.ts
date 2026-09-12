/**
 * Differentiation, and the derivation that produced it.
 *
 * Vector Tools already differentiates — `symbolic.ts` does exact partials for
 * generating expressions — and this is deliberately a different thing rather
 * than a copy of it. That one answers "what is the derivative"; this one has to
 * answer "what did you do, and why there", which changes the shape of the code:
 * every rule reports itself, the dispatch has to pick the rule a course would
 * pick rather than merely a correct one, and simplification is kept separate so
 * the intermediate form is still visible.
 *
 * ## One pass, not two
 *
 * The derivative and its explanation are built by the same recursion and come
 * back together. Nothing here computes an answer and then reconstructs a story
 * for it, because a story reconstructed from an answer can disagree with it —
 * and the disagreement would be invisible, since both halves look plausible.
 * `derive` returns `{ derivative, step }` at every node and there is no other
 * way to get either.
 *
 * ## A tree, not a list
 *
 * The steps nest the way the expression does. `x²(sin 3x)^{eˣ}` is a product
 * whose second factor needs logarithmic differentiation whose base needs the
 * chain rule, and flattening that into seven numbered cards throws away the one
 * thing worth teaching: that a rule ran *inside* another. Each step keeps its
 * children, and the panel renders the hierarchy.
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
 * - `3x` is neither: it is one atomic fact, `d/dx(cx) = c`. Spending two cards
 *   on a coefficient and a derivative of 1 is how a short derivation becomes
 *   thirty steps long.
 * - `x²` takes the power rule **without** the chain rule, because the chain
 *   rule's inner derivative is 1 and a step that multiplies by 1 teaches
 *   nothing. `(3x+1)²` takes both, and is named for both.
 * - `2^x` is the **exponential** rule, not the power rule — the variable is
 *   upstairs. `x^x` is neither, and needs logarithmic differentiation.
 * - `f/c` for constant c is a constant multiple, not a quotient; the quotient
 *   rule on it produces a squared denominator that then cancels.
 *
 * The power rule and the general power rule are separate rules here rather than
 * one rule with a special case, and the prose for the ordinary one says *the
 * exponent is a constant* before it says to bring it down. An expression can
 * contain `x²` and `(sin 3x)^{eˣ}` at once — and "bring the exponent down as a
 * factor" read beside the second of those is not a simplification but a
 * falsehood, one a reader will carry to the next problem.
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

/**
 * A bracketed group, so a deferred derivative shows what it is taken of.
 *
 * The emitter brackets what sits under a `d/dx` only when it binds looser than
 * addition, so `d/dx x²sin(3x)` would come out with nothing to mark where the
 * product ends. A paren-wrapped `Seq` is the one construction the emitter
 * always brackets, whatever is inside it.
 */
const paren = (node: Node): Node => ({
  type: "Seq",
  parenWrapped: true,
  args: [node],
});

/** `d/dv(node)`, left undone: the placeholder a rule leaves for its children. */
const pending = (node: Node, variable: string): Node => ({
  type: "Derivative",
  arg: paren(node),
  variable: id(variable),
});

/** Thrown for anything this cannot differentiate exactly. */
export class DifferentiationError extends Error {}

export type RuleName =
  | "constant"
  | "identity"
  | "linear"
  | "constant-multiple"
  | "power"
  | "power-chain"
  | "sum"
  | "product"
  | "quotient"
  | "chain"
  | "exponential"
  | "exponential-chain"
  | "exponential-base"
  | "exponential-base-chain"
  | "logarithm"
  | "trigonometric"
  | "inverse-trigonometric"
  | "hyperbolic"
  | "root"
  | "absolute"
  | "logarithmic-differentiation"
  | "implicit";

/**
 * The rule in general, for the rules that have a form worth memorising.
 *
 * Separate from the prose because it is a different kind of statement. The
 * prose says what to do with *this* expression; the formula is the thing that
 * transfers to the next one, and it is the half a reader is trying to learn.
 * Kept as LaTeX so the panel renders it as maths rather than printing `u'v`.
 *
 * Rules without an entry are the ones whose statement is already the sentence —
 * "a constant differentiates to zero" gains nothing from being written twice.
 *
 * The chained forms are spelled out rather than left to the reader to combine.
 * `d/dx u^n = nu^{n-1}` written beside an expression whose base is `3x+1` is
 * the exact omission that produces a missing factor of 3.
 */
export const RULE_FORMULAS: Partial<Record<RuleName, string>> = {
  linear: String.raw`\frac{d}{dx}\left(cx\right)=c`,
  "constant-multiple": String.raw`\left(cf\right)'=cf'`,
  power: String.raw`\frac{d}{dx}x^{n}=nx^{n-1}`,
  "power-chain": String.raw`\frac{d}{dx}u^{n}=nu^{n-1}u'`,
  sum: String.raw`\left(f+g\right)'=f'+g'`,
  product: String.raw`\left(uv\right)'=u'v+uv'`,
  quotient: String.raw`\left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^{2}}`,
  chain: String.raw`\frac{d}{dx}f\left(u\right)=f'\left(u\right)u'`,
  exponential: String.raw`\frac{d}{dx}e^{x}=e^{x}`,
  "exponential-chain": String.raw`\frac{d}{dx}e^{u}=e^{u}u'`,
  "exponential-base": String.raw`\frac{d}{dx}a^{x}=a^{x}\ln a`,
  "exponential-base-chain": String.raw`\frac{d}{dx}a^{u}=a^{u}u'\ln a`,
  "logarithmic-differentiation": String.raw`\frac{d}{dx}u^{v}=u^{v}\left(v'\ln u+\frac{vu'}{u}\right)`,
  implicit: String.raw`\frac{dy}{dx}=-\frac{F_{x}}{F_{y}}`,
};

/**
 * How much of the derivation a step is.
 *
 * Not decoration: it decides what the panel shows without being asked. A
 * derivation of a moderately nested expression contains more derivatives of `x`
 * and of constants than it contains ideas, and showing all of them at equal
 * weight buries the two or three that matter.
 *
 * - `major` — a structural decision. Which rule, and why this one.
 * - `supporting` — a sub-problem worth naming. "Differentiate x²."
 * - `atomic` — a fact. The derivative of x is 1; a constant goes to 0.
 */
export type Importance = "major" | "supporting" | "atomic";

/** A name a rule gave to a piece of the expression, so the prose can use it. */
export interface Substitution {
  symbol: string;
  value: Node;
}

/**
 * Something the derivation assumed in order to stay real-valued.
 *
 * Only recorded where the *derivation* introduces the assumption, never where
 * the expression already carried it. A logarithm appearing in the answer to a
 * question that never mentioned one is a fact about the method, and leaving it
 * out teaches that `(-2)^{eˣ}` is an ordinary differentiable function. A
 * condition the reader can already see — that `ln u` wants a positive `u` — is
 * not repeated back to them, because a note that always appears is one nobody
 * reads on the occasion it matters.
 */
export interface DomainCondition {
  expression: Node;
  requirement: "positive";
}

export interface DerivationNode {
  rule: RuleName;
  /** The rule's name, as a course names it. */
  title: string;
  /** The structure that was recognised, which is why this rule and not another. */
  recognition: string;
  /** What applying it does here. Empty when the formula beside it says so. */
  detail: string;
  importance: Importance;
  /** The expression this step differentiates. */
  before: Node;
  /**
   * The rule applied, with each child's derivative still written as `d/dx(…)`.
   *
   * The line a worked solution actually shows. Jumping from the product rule
   * straight to a fully expanded answer hides the move being taught, which is
   * that `(uv)' = u'v + uv'` turns one problem into two smaller ones.
   * Undefined for rules with no children to defer.
   */
  intermediate?: Node;
  /** What the rule produces once the children are in, before simplification. */
  after: Node;
  substitutions: readonly Substitution[];
  domain: readonly DomainCondition[];
  children: readonly DerivationNode[];
}

export interface Derivation {
  /** The derivative, simplified. */
  result: Node;
  /** The derivative exactly as the rules produced it. */
  raw: Node;
  root: DerivationNode;
  /** Every assumption the derivation made, gathered from the tree. */
  domain: readonly DomainCondition[];
}

/** What one rule returns: the derivative, and how it got there. */
interface Working {
  derivative: Node;
  step: DerivationNode;
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
 * The derivative of `node` with respect to `variable`, with its derivation.
 *
 * `cfg` is needed because a step can only say what it did in terms of the
 * actual sub-expressions, and saying that means emitting them.
 */
export function differentiate(
  cfg: Config,
  node: Node,
  variable: string
): Derivation {
  const { derivative, step } = derive(cfg, node, variable);
  return {
    result: simplify(derivative),
    raw: derivative,
    root: step,
    domain: gatherDomain(step),
  };
}

function gatherDomain(step: DerivationNode): DomainCondition[] {
  const found: DomainCondition[] = [...step.domain];
  for (const child of step.children) found.push(...gatherDomain(child));
  return found;
}

function derive(cfg: Config, node: Node, variable: string): Working {
  // Anything without the variable in it is a constant, whatever it is made of.
  if (!dependsOn(node, variable)) {
    return leaf({
      rule: "constant",
      title: "Constant rule",
      recognition: `This part contains no ${variable}.`,
      detail: "A constant does not change, so its derivative is 0.",
      before: node,
      after: number(0),
    });
  }

  switch (node.type) {
    case "Identifier":
      return leaf({
        rule: "identity",
        title: "Derivative of the variable",
        recognition: `This is ${variable} on its own.`,
        detail: `The derivative of ${variable} with respect to itself is 1.`,
        before: node,
        after: number(1),
      });

    case "Negative": {
      const inner = derive(cfg, node.arg, variable);
      return {
        derivative: negative(inner.derivative),
        step: {
          rule: "constant-multiple",
          title: "Constant multiple rule",
          recognition: "A leading minus sign is a factor of -1.",
          detail: "It comes along unchanged.",
          importance: "atomic",
          before: node,
          intermediate: negative(pending(node.arg, variable)),
          after: negative(inner.derivative),
          substitutions: [],
          domain: [],
          children: [inner.step],
        },
      };
    }

    case "BinaryOperator":
      return binaryRule(cfg, node, variable);

    case "FunctionCall":
      return functionCallRule(cfg, node, variable);

    default:
      throw new DifferentiationError(
        `${describe(node)} cannot be differentiated here.`
      );
  }
}

/** A step with no sub-derivations: one fact, stated. */
function leaf(partial: {
  rule: RuleName;
  title: string;
  recognition: string;
  detail: string;
  before: Node;
  after: Node;
}): Working {
  return {
    derivative: partial.after,
    step: {
      ...partial,
      importance: "atomic",
      substitutions: [],
      domain: [],
      children: [],
    },
  };
}

function binaryRule(
  cfg: Config,
  node: Aug.Latex.BinaryOperator,
  variable: string
): Working {
  const { left, right } = node;
  const leftHas = dependsOn(left, variable);
  const rightHas = dependsOn(right, variable);

  switch (node.name) {
    case "Add":
    case "Subtract":
      return sumRule(cfg, node, variable);

    case "Multiply":
    case "CrossMultiply": {
      // A factor without the variable is a coefficient, not a second function.
      // The product rule here is correct and produces a zero term nobody writes.
      if (!leftHas || !rightHas) {
        const [constant, varying] = leftHas ? [right, left] : [left, right];
        // `3x` is one fact, not a coefficient rule wrapped round a derivative
        // of 1. Two cards for it is how a short derivation becomes a long one.
        if (isVariable(varying, variable)) {
          return leaf({
            rule: "linear",
            title: "Derivative of a linear term",
            recognition: `This is a constant times ${variable}.`,
            detail: "Its derivative is that constant.",
            before: node,
            after: constant,
          });
        }
        const inner = derive(cfg, varying, variable);
        return {
          derivative: multiply(constant, inner.derivative),
          step: {
            rule: "constant-multiple",
            title: "Constant multiple rule",
            recognition: `One factor contains no ${variable}, so it is a coefficient rather than a second function.`,
            detail: "It stays put; only the other factor is differentiated.",
            importance: "supporting",
            before: node,
            intermediate: multiply(constant, pending(varying, variable)),
            after: multiply(constant, inner.derivative),
            substitutions: [],
            domain: [],
            children: [inner.step],
          },
        };
      }
      const dLeft = derive(cfg, left, variable);
      const dRight = derive(cfg, right, variable);
      const product = (dU: Node, dV: Node) =>
        add(multiply(dU, right), multiply(left, dV));
      return {
        derivative: product(dLeft.derivative, dRight.derivative),
        step: {
          rule: "product",
          title: "Product rule",
          recognition: "The expression is a product of two functions.",
          detail: "",
          importance: "major",
          before: node,
          intermediate: product(
            pending(left, variable),
            pending(right, variable)
          ),
          after: product(dLeft.derivative, dRight.derivative),
          substitutions: [
            { symbol: "u", value: left },
            { symbol: "v", value: right },
          ],
          domain: [],
          children: [dLeft.step, dRight.step],
        },
      };
    }

    case "Divide": {
      // Dividing by a constant is multiplying by its reciprocal. The quotient
      // rule would square that constant and then cancel it again.
      if (!rightHas) {
        const inner = derive(cfg, left, variable);
        return {
          derivative: divide(inner.derivative, right),
          step: {
            rule: "constant-multiple",
            title: "Constant multiple rule",
            recognition: `The denominator contains no ${variable}.`,
            detail:
              "A constant denominator divides the derivative of the numerator, so the quotient rule is not needed.",
            importance: "supporting",
            before: node,
            intermediate: divide(pending(left, variable), right),
            after: divide(inner.derivative, right),
            substitutions: [],
            domain: [],
            children: [inner.step],
          },
        };
      }
      const dLeft = derive(cfg, left, variable);
      const dRight = derive(cfg, right, variable);
      const quotient = (dU: Node, dV: Node) =>
        divide(
          subtract(multiply(dU, right), multiply(left, dV)),
          square(right)
        );
      return {
        derivative: quotient(dLeft.derivative, dRight.derivative),
        step: {
          rule: "quotient",
          title: "Quotient rule",
          recognition: `${variable} is above and below the line.`,
          detail: "",
          importance: "major",
          before: node,
          intermediate: quotient(
            pending(left, variable),
            pending(right, variable)
          ),
          after: quotient(dLeft.derivative, dRight.derivative),
          substitutions: [
            { symbol: "u", value: left },
            { symbol: "v", value: right },
          ],
          domain: [],
          children: [dLeft.step, dRight.step],
        },
      };
    }

    case "Exponent":
      return exponentRule(cfg, node, left, right, variable);
  }
}

/**
 * Every term of a sum in one step.
 *
 * `x⁴+3x²-7x+2` is one idea — derivatives distribute — and nesting it as three
 * binary sums produces three identical cards saying so. The chain is flattened
 * first, and the terms become the children of a single step.
 */
function sumRule(
  cfg: Config,
  node: Aug.Latex.BinaryOperator,
  variable: string
): Working {
  const terms: { term: Node; negated: boolean }[] = [];
  collectTerms(node, false, terms);
  const worked = terms.map((entry) => ({
    ...entry,
    working: derive(cfg, entry.term, variable),
  }));
  const assemble = (value: (entry: (typeof worked)[number]) => Node) =>
    rebuildSum(
      worked.map((entry) => ({ value: value(entry), negated: entry.negated }))
    );
  const after = assemble((entry) => entry.working.derivative);
  const anyNegated = terms.some((entry) => entry.negated);
  return {
    derivative: after,
    step: {
      rule: "sum",
      title: anyNegated ? "Sum and difference rule" : "Sum rule",
      recognition: `This is ${terms.length} terms added${anyNegated ? " and subtracted" : ""}.`,
      detail:
        "Derivatives distribute over addition, so differentiate each term on its own and keep the signs.",
      importance: "supporting",
      before: node,
      intermediate: assemble((entry) => pending(entry.term, variable)),
      after,
      substitutions: [],
      domain: [],
      children: worked.map((entry) => entry.working.step),
    },
  };
}

/**
 * The top-level terms of a sum, with their signs.
 *
 * The one place an answer can be broken over lines without changing what it
 * looks like it says. A break inside a product, or under a fraction bar, reads
 * as a different expression.
 */
export function topLevelTerms(
  node: Node
): readonly { term: Node; negated: boolean }[] {
  const out: { term: Node; negated: boolean }[] = [];
  collectTerms(node, false, out);
  return out;
}

function collectTerms(
  node: Node,
  negated: boolean,
  out: { term: Node; negated: boolean }[]
) {
  if (node.type === "BinaryOperator") {
    if (node.name === "Add") {
      collectTerms(node.left, negated, out);
      collectTerms(node.right, negated, out);
      return;
    }
    if (node.name === "Subtract") {
      collectTerms(node.left, negated, out);
      collectTerms(node.right, !negated, out);
      return;
    }
  }
  out.push({ term: node, negated });
}

function rebuildSum(parts: readonly { value: Node; negated: boolean }[]): Node {
  let result: Node | undefined;
  for (const part of parts) {
    if (result === undefined) {
      result = part.negated ? negative(part.value) : part.value;
    } else {
      result = part.negated
        ? subtract(result, part.value)
        : add(result, part.value);
    }
  }
  return result ?? number(0);
}

/**
 * The three genuinely different cases of `u^v`, and they are not variations on
 * one rule: which of them applies depends entirely on where the variable is.
 */
function exponentRule(
  cfg: Config,
  node: Node,
  base: Node,
  exponent: Node,
  variable: string
): Working {
  const baseHas = dependsOn(base, variable);
  const exponentHas = dependsOn(exponent, variable);

  if (baseHas && !exponentHas) {
    const lowered = simplify(subtract(exponent, number(1)));
    const outer = multiply(exponent, power(base, lowered));
    // The chain rule's inner derivative is 1 when the base is the bare
    // variable, and a step that multiplies by 1 is noise.
    if (isVariable(base, variable)) {
      return {
        derivative: outer,
        step: {
          rule: "power",
          title: "Power rule",
          recognition: `The exponent is a constant and the base is ${variable} itself, so the ordinary power rule applies.`,
          detail: "Bring the exponent down as a factor and reduce it by one.",
          importance: "supporting",
          before: node,
          after: outer,
          substitutions: [],
          domain: [],
          children: [],
        },
      };
    }
    const inner = derive(cfg, base, variable);
    return {
      derivative: multiply(outer, inner.derivative),
      step: {
        rule: "power-chain",
        title: "Power rule with the chain rule",
        recognition: `The exponent is a constant, so the power rule applies — but the base is a whole expression rather than ${variable}, so the chain rule comes with it.`,
        detail: "",
        importance: "major",
        before: node,
        intermediate: multiply(outer, pending(base, variable)),
        after: multiply(outer, inner.derivative),
        substitutions: [{ symbol: "u", value: base }],
        domain: [],
        children: [inner.step],
      },
    };
  }

  if (!baseHas && exponentHas) {
    const isE = base.type === "Identifier" && base.symbol === "e";
    const outer = isE
      ? power(base, exponent)
      : multiply(power(base, exponent), call("ln", base));
    const recognition = `The base is constant and ${variable} is in the exponent, so this is an exponential, not a power.`;
    if (isVariable(exponent, variable)) {
      return {
        derivative: outer,
        step: {
          rule: isE ? "exponential" : "exponential-base",
          title: isE ? "Derivative of e to the x" : "Derivative of a to the x",
          recognition,
          detail: isE
            ? "The exponential is its own derivative."
            : "It differentiates to itself times the natural log of the base.",
          importance: "supporting",
          before: node,
          after: outer,
          substitutions: [],
          domain: [],
          children: [],
        },
      };
    }
    const inner = derive(cfg, exponent, variable);
    return {
      derivative: multiply(outer, inner.derivative),
      step: {
        rule: isE ? "exponential-chain" : "exponential-base-chain",
        title: "Exponential rule with the chain rule",
        recognition: `${recognition} The exponent is a whole expression, so the chain rule comes with it.`,
        detail: "",
        importance: "major",
        before: node,
        intermediate: multiply(outer, pending(exponent, variable)),
        after: multiply(outer, inner.derivative),
        substitutions: [{ symbol: "u", value: exponent }],
        domain: [],
        children: [inner.step],
      },
    };
  }

  // The variable is in both places, so neither the power rule nor the
  // exponential rule applies: u^v = e^{v ln u} is the only way through.
  const dBase = derive(cfg, base, variable);
  const dExponent = derive(cfg, exponent, variable);
  const built = (dU: Node, dV: Node) =>
    multiply(
      power(base, exponent),
      add(multiply(dV, call("ln", base)), divide(multiply(exponent, dU), base))
    );
  return {
    derivative: built(dBase.derivative, dExponent.derivative),
    step: {
      rule: "logarithmic-differentiation",
      title: "Logarithmic differentiation",
      recognition: `${variable} is in both the base and the exponent, so neither the power rule nor the exponential rule applies.`,
      detail:
        "Taking logs first turns the power into a product, which the product and chain rules can handle. Do not bring the exponent down: it is not a constant.",
      importance: "major",
      before: node,
      intermediate: built(pending(base, variable), pending(exponent, variable)),
      after: built(dBase.derivative, dExponent.derivative),
      substitutions: [
        { symbol: "u", value: base },
        { symbol: "v", value: exponent },
      ],
      // The log of the base ends up in the answer whether or not the question
      // mentioned one, so the answer is only real where the base is positive.
      domain: [{ expression: base, requirement: "positive" }],
      children: [dBase.step, dExponent.step],
    },
  };
}

function functionCallRule(
  cfg: Config,
  node: Aug.Latex.FunctionCall,
  variable: string
): Working {
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
    return {
      derivative: outer,
      step: {
        rule: known.rule,
        title: known.title,
        recognition: `The function is applied to ${variable} on its own.`,
        detail: `${known.says}.`,
        importance: "supporting",
        before: node,
        after: outer,
        substitutions: [],
        domain: [],
        children: [],
      },
    };
  }
  const inner = derive(cfg, argument, variable);
  return {
    derivative: multiply(outer, inner.derivative),
    step: {
      rule: "chain",
      title: "Chain rule",
      recognition: `The inside is a whole expression rather than ${variable} on its own, so this is one function composed with another.`,
      detail: `${known.says}. Differentiate the outside, leave the inside alone, then multiply by the derivative of the inside.`,
      importance: "major",
      before: node,
      intermediate: multiply(outer, pending(argument, variable)),
      after: multiply(outer, inner.derivative),
      substitutions: [{ symbol: "u", value: argument }],
      domain: [],
      children: [inner.step],
    },
  };
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
  const partialX = derive(cfg, f, independent);
  const partialY = derive(cfg, f, dependent);
  const raw = negative(divide(partialX.derivative, partialY.derivative));
  const root: DerivationNode = {
    rule: "implicit",
    title: "Implicit differentiation",
    recognition: `${dependent} is not given as a function of ${independent}, so it cannot be differentiated directly.`,
    detail: `Move everything to one side as F = ${toLatex(cfg, f)}, then take one partial derivative in each variable.`,
    importance: "major",
    before: f,
    after: raw,
    substitutions: [{ symbol: "F", value: f }],
    domain: [],
    children: [partialX.step, partialY.step],
  };
  return { result: simplify(raw), raw, root, domain: gatherDomain(root) };
}

/**
 * The steps of a derivation in reading order, outermost rule first.
 *
 * A pre-order walk, which is the order a worked solution is written in: name
 * the rule, then do the smaller problems it asked for. The completion order the
 * recursion naturally produces is the reverse, and reads as a log.
 *
 * `depth` comes back with each step so the panel can indent a sub-derivation
 * under the rule that asked for it.
 */
export function stepsOf(
  root: DerivationNode
): readonly { step: DerivationNode; depth: number }[] {
  const out: { step: DerivationNode; depth: number }[] = [];
  const walk = (step: DerivationNode, depth: number) => {
    out.push({ step, depth });
    for (const child of step.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

/**
 * What to look at, in the order a reader should look at it.
 *
 * Taken from the derivation rather than written by hand, so a hint cannot point
 * at a structure the expression does not have. Only the outer two levels, and
 * only the steps that were a decision: a hint reading "the derivative of x is
 * 1" has given away nothing and helped nobody.
 */
export function hintsFor(root: DerivationNode): readonly string[] {
  const hints: string[] = [];
  const walk = (step: DerivationNode, depth: number) => {
    if (depth > 1) return;
    if (step.importance !== "atomic" && !hints.includes(step.recognition))
      hints.push(step.recognition);
    for (const child of step.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return hints.slice(0, 3);
}

/**
 * The same problem with different numbers in it.
 *
 * Generated by changing the constants and leaving the shape alone, which is
 * what makes it genuinely *similar*: the tree is unchanged, so the dispatch
 * takes the same branches and the worked example uses exactly the rules that
 * were just explained. Picking a second problem by hand — or from a list —
 * gives something that looks alike and may need a rule the reader has not met.
 *
 * An exponent is never allowed to land on 0 or 1, because both collapse the
 * power rule into a case that is no longer an example of it.
 */
export function similarExample(node: Node): Node {
  return nudge(node, false);
}

function nudge(node: Node, isExponent: boolean): Node {
  switch (node.type) {
    case "Constant": {
      let next = node.value + 1;
      if (isExponent && (next === 0 || next === 1)) next += 1;
      return number(next);
    }
    case "Negative":
      return negative(nudge(node.arg, isExponent));
    case "FunctionCall":
      return { ...node, args: node.args.map((arg) => nudge(arg, false)) };
    case "BinaryOperator":
      return {
        ...node,
        left: nudge(node.left, false),
        // Only the right-hand side of a power is an exponent.
        right: nudge(node.right, node.name === "Exponent"),
      };
    default:
      return node;
  }
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
