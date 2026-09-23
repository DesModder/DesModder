/**
 * Antiderivatives of the integrals that do not have one.
 *
 * `∫e^{x²}dx` has no elementary antiderivative. That is a theorem, not a gap in
 * the integrator — there is no combination of the functions a calculator has
 * that differentiates to `e^{x²}`, and the integrator is right to refuse it.
 *
 * What there *is* is a power series, and it is exact:
 *
 *     ∫e^{x²}dx = Σ_{n=0}^{∞} x^{2n+1} / ((2n+1) n!)
 *
 * which is the answer to the question, written in the one form that can be. The
 * same move gives `Si(x)` from `sin(x)/x`, the error function from `e^{-x²}`
 * and the Fresnel integrals from `sin(x²)` — the named non-elementary functions
 * are, almost without exception, exactly this.
 *
 * ## What it can do, and how
 *
 * The integrand has to be a constant times a power of the variable times one
 * known function of a monomial:
 *
 *     c · x^m · f(a x^k)
 *
 * which covers every case above and most of the ones a course asks for. Each
 * `f` contributes a general term from the table below, the monomial raises the
 * variable's exponent, and integrating term by term divides by the new one. The
 * result is a *closed* general term in `n`, not a truncation — the truncation
 * is offered as well, because Desmos needs a finite upper bound to plot one.
 *
 * ## Why this is not the integrator quietly guessing
 *
 * It is a separate function with its own name, and nothing calls it by
 * accident. `integrate` still refuses `e^{x²}`, because a series is a different
 * kind of answer to a different question: it converges on an interval, it is
 * written with a sum rather than in closed form, and a reader who asked for an
 * antiderivative and got a series without being told would be entitled to think
 * the first one was elementary after all. So the caller asks for it, and the
 * result carries the interval it is valid on.
 */
import {
  add,
  binop,
  call,
  constantValue,
  dependsOn,
  divide,
  expand,
  fold,
  freshName,
  id,
  multiply,
  number,
  power,
  quotientFactors,
  rationalNode,
  rationalOf,
  replaceIdentifier,
  subtract,
  type Node,
} from "../../../symbolic";

/** Thrown for an integrand no series here can be built from. */
export class SeriesError extends Error {}

/**
 * One Maclaurin series, as the general term of `f(u)`.
 *
 * `coefficient` and `exponent` are both functions of the index, which is what
 * makes the result a closed form rather than a list: a series whose terms are
 * written out can only ever be an approximation, and one whose general term is
 * known is the function.
 */
interface SeriesEntry {
  /** The coefficient of `u^{exponent(n)}`. */
  coefficient: (n: Node) => Node;
  /** The power of `u` in the nth term. */
  exponent: (n: Node) => Node;
  /** Where the index starts. */
  from: number;
  /** Where the series converges, in words, for the note on the answer. */
  interval: string;
}

const factorial = (arg: Node): Node => ({ type: "Factorial", arg });
const alternating = (n: Node): Node => power(number(-1), n);
const twice = (n: Node) => multiply(number(2), n);
const twicePlusOne = (n: Node) => add(twice(n), number(1));

/**
 * The series a first course meets, and nothing more.
 *
 * Each one is standard and each is written the way it is usually printed, so
 * that an answer built from it is recognisable. They are all series in `u`; the
 * substitution `u = a x^k` happens once, below, rather than being baked into
 * each entry.
 */
const SERIES: Record<string, SeriesEntry> = {
  exp: {
    coefficient: (n) => divide(number(1), factorial(n)),
    exponent: (n) => n,
    from: 0,
    interval: "every x",
  },
  sin: {
    coefficient: (n) => divide(alternating(n), factorial(twicePlusOne(n))),
    exponent: twicePlusOne,
    from: 0,
    interval: "every x",
  },
  cos: {
    coefficient: (n) => divide(alternating(n), factorial(twice(n))),
    exponent: twice,
    from: 0,
    interval: "every x",
  },
  sinh: {
    coefficient: (n) => divide(number(1), factorial(twicePlusOne(n))),
    exponent: twicePlusOne,
    from: 0,
    interval: "every x",
  },
  cosh: {
    coefficient: (n) => divide(number(1), factorial(twice(n))),
    exponent: twice,
    from: 0,
    interval: "every x",
  },
  arctan: {
    coefficient: (n) => divide(alternating(n), twicePlusOne(n)),
    exponent: twicePlusOne,
    from: 0,
    interval: "|x| <= 1",
  },
  // ln(1+u) rather than ln(u), which has no Maclaurin series at all: it is
  // undefined at zero, and every term of a series about zero would be one.
  ln1p: {
    coefficient: (n) => divide(alternating(add(n, number(1))), n),
    exponent: (n) => n,
    from: 1,
    interval: "-1 < x <= 1",
  },
  /** 1/(1-u), the geometric series, which is where most of the others start. */
  geometric: {
    coefficient: () => number(1),
    exponent: (n) => n,
    from: 0,
    interval: "|x| < 1",
  },
};

export interface SeriesAntiderivative {
  /** The general term, as an expression in the index and the variable. */
  term: Node;
  /** The index's name. */
  index: string;
  /** Where the index starts. */
  from: number;
  /** The sum, with a finite upper bound, ready for Desmos to plot. */
  sum: Node;
  /** The first few terms written out, for reading rather than plotting. */
  partial: Node;
  /** Where the series converges. */
  interval: string;
  /** Which series it was built from, so the caller can say. */
  source: string;
}

/** How many terms the plottable sum carries unless the caller says otherwise. */
export const DEFAULT_SERIES_TERMS = 20;

/** How many terms the written-out form shows. */
const PARTIAL_TERMS = 4;

/**
 * The antiderivative of `node` as a power series.
 *
 * Throws {@link SeriesError} for an integrand this cannot read, which is most
 * of them — the point is the handful it can, and those are the ones nothing
 * else can do at all.
 */
export function seriesAntiderivative(
  node: Node,
  variable: string,
  terms = DEFAULT_SERIES_TERMS
): SeriesAntiderivative {
  const shape = readIntegrand(fold(node), variable);
  const entry = SERIES[shape.series];
  const index = freshName(node, ["n", "k", "j"]);
  const n = id(index);

  // The inner function contributes `u^{e(n)}` with `u = a x^k`, so the power of
  // x is `k e(n)` and the constant `a` comes along raised to the same power.
  const innerExponent = entry.exponent(n);
  const xPower = add(
    add(
      multiply(number(shape.monomialPower), innerExponent),
      number(shape.outerPower)
    ),
    number(1)
  );
  const raisedScale = power(shape.scale, innerExponent);

  // Integrating `x^{E-1}` gives `x^{E}/E`, so the new exponent divides.
  //
  // Multiplied out, because `2(2n+1)+1` and `4n+3` are the same exponent and
  // only one of them is an answer. This is the one place the expander is used
  // for how something reads rather than for what a rule can match.
  const degree = fold(expand(xPower).node);
  if (vanishes(degree, index, entry.from, terms)) {
    throw new SeriesError(
      "One term of this series would be a logarithm rather than a power, so it has no single general term."
    );
  }

  const coefficient = fold(
    divide(
      multiply(multiply(shape.constant, entry.coefficient(n)), raisedScale),
      degree
    )
  );
  const term = fold(multiply(coefficient, power(id(variable), degree)));

  return {
    term,
    index,
    from: entry.from,
    sum: {
      type: "RepeatedOperator",
      name: "Sum",
      index: { type: "Identifier", symbol: index },
      start: number(entry.from),
      end: number(entry.from + terms - 1),
      expression: term,
    },
    partial: writtenOut(term, index, entry.from),
    interval: entry.interval,
    source: shape.series,
  };
}

/** The first few terms, added up, with the index substituted in each. */
function writtenOut(term: Node, index: string, from: number): Node {
  let total: Node | undefined;
  for (let i = from; i < from + PARTIAL_TERMS; i += 1) {
    const value = fold(replaceIdentifier(term, index, number(i)));
    total = total === undefined ? value : fold(add(total, value));
  }
  return total ?? number(0);
}

/**
 * Whether the exponent this divides by is zero for any index in range.
 *
 * `∫dx/x` is a logarithm, and a series term with a zero exponent is exactly
 * that case hiding inside a general term. Rather than emit a division by zero,
 * the whole thing is refused.
 */
function vanishes(
  degree: Node,
  index: string,
  from: number,
  terms: number
): boolean {
  for (let i = from; i < from + terms; i += 1) {
    const value = constantValue(
      fold(replaceIdentifier(degree, index, number(i)))
    );
    if (value === 0) return true;
  }
  return false;
}

/** The integrand, read as `c · x^m · f(a x^k)`. */
interface Shape {
  constant: Node;
  outerPower: number;
  series: string;
  scale: Node;
  monomialPower: number;
}

function readIntegrand(node: Node, variable: string): Shape {
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);

  let constant: Node = number(1);
  let outerPower = 0;
  let inner: { series: string; scale: Node; monomialPower: number } | undefined;

  for (const { node: factor, inNumerator } of factors) {
    const sign = inNumerator ? 1 : -1;
    if (!dependsOn(factor, variable)) {
      constant = inNumerator
        ? multiply(constant, factor)
        : divide(constant, factor);
      continue;
    }
    const monomial = asMonomialPower(factor, variable);
    if (monomial !== undefined) {
      outerPower += sign * monomial;
      continue;
    }
    if (inner !== undefined) {
      throw new SeriesError(
        "A series is only built for one known function of a power of the variable, times a constant and a power."
      );
    }
    if (!inNumerator) {
      // `1/(1 - u)` is the geometric series, and it is the one entry with no
      // function of its own to be recognised by: it is a shape in the
      // denominator rather than a call anybody wrote.
      const geometric = asOneMinus(factor);
      const monomial =
        geometric === undefined
          ? undefined
          : asScaledMonomial(geometric, variable);
      if (monomial === undefined) {
        throw new SeriesError(
          "A series is only built for one known function of a power of the variable, times a constant and a power."
        );
      }
      inner = { series: "geometric", ...monomial };
      continue;
    }
    inner = asKnownSeries(factor, variable);
  }

  if (inner === undefined) {
    throw new SeriesError(
      "Nothing in this integrand is a function with a series this knows."
    );
  }
  return { constant: fold(constant), outerPower, ...inner };
}

/** `x`, `x^m` or `1` as its exponent, or `undefined` for anything else. */
function asMonomialPower(node: Node, variable: string): number | undefined {
  if (node.type === "Identifier")
    return node.symbol === variable ? 1 : undefined;
  if (node.type === "BinaryOperator" && node.name === "Exponent") {
    if (node.left.type !== "Identifier" || node.left.symbol !== variable)
      return undefined;
    const exponent = constantValue(fold(node.right));
    return exponent !== undefined && Number.isInteger(exponent)
      ? exponent
      : undefined;
  }
  return undefined;
}

/**
 * A call this has a series for, with the monomial inside it.
 *
 * `e^{...}` is recognised as well as `exp(...)`, because that is how anybody
 * writes it, and `1/(1-u)` and `ln(1+u)` are recognised from their arguments
 * rather than by name — those two have no function of their own.
 */
function asKnownSeries(
  node: Node,
  variable: string
): { series: string; scale: Node; monomialPower: number } {
  const argument = seriesArgument(node);
  if (argument === undefined) {
    throw new SeriesError(
      "A series is only built around one of the standard functions."
    );
  }
  const monomial = asScaledMonomial(argument.inside, variable);
  if (monomial === undefined) {
    throw new SeriesError(
      "The function's argument has to be a constant times a power of the variable."
    );
  }
  return { series: argument.series, ...monomial };
}

function seriesArgument(
  node: Node
): { series: string; inside: Node } | undefined {
  if (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    node.left.type === "Identifier" &&
    node.left.symbol === "e"
  ) {
    return { series: "exp", inside: node.right };
  }
  if (node.type !== "FunctionCall" || node.args.length !== 1) return undefined;
  const name = node.callee.symbol;
  const [inside] = node.args;
  if (SERIES[name] !== undefined) return { series: name, inside };
  if (name === "ln") {
    // ln(1+u). Read off the sum rather than by name, because there is no
    // function called `ln1p` for anybody to have written.
    const shifted = asOnePlus(inside);
    return shifted === undefined
      ? undefined
      : { series: "ln1p", inside: shifted };
  }
  return undefined;
}

/** `1 - u` as `u`, for the geometric series. */
function asOneMinus(node: Node): Node | undefined {
  if (node.type !== "BinaryOperator") return undefined;
  if (node.name === "Subtract" && constantValue(node.left) === 1)
    return node.right;
  if (node.name === "Add") {
    if (constantValue(node.left) === 1)
      return fold({ type: "Negative", arg: node.right });
    if (constantValue(node.right) === 1)
      return fold({ type: "Negative", arg: node.left });
  }
  return undefined;
}

/** `1 + u` as `u`, for the logarithm's series. */
function asOnePlus(node: Node): Node | undefined {
  if (node.type !== "BinaryOperator") return undefined;
  if (node.name === "Add") {
    if (constantValue(node.left) === 1) return node.right;
    if (constantValue(node.right) === 1) return node.left;
  }
  if (node.name === "Subtract" && constantValue(node.left) === 1) {
    return fold({ type: "Negative", arg: node.right });
  }
  return undefined;
}

/** `a x^k` as its constant and its power. */
function asScaledMonomial(
  node: Node,
  variable: string
): { scale: Node; monomialPower: number } | undefined {
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);
  let scale: Node = number(1);
  let monomialPower: number | undefined;
  for (const { node: factor, inNumerator } of factors) {
    if (!dependsOn(factor, variable)) {
      scale = inNumerator ? multiply(scale, factor) : divide(scale, factor);
      continue;
    }
    const power = asMonomialPower(factor, variable);
    if (power === undefined || monomialPower !== undefined) return undefined;
    monomialPower = inNumerator ? power : -power;
  }
  if (monomialPower === undefined || monomialPower <= 0) return undefined;
  return { scale: fold(scale), monomialPower };
}

/** Kept for the tests, which check the reading before the arithmetic. */
export const forTesting = {
  readIntegrand,
  binop,
  subtract,
  call,
  rationalNode,
  rationalOf,
};
