/**
 * Trigonometric substitution: the technique for a root that a plain
 * substitution cannot touch.
 *
 * `∫√(1-x²)dx` has no `u` whose derivative divides out, because the thing in
 * the way is not a composition — it is a *shape*. What clears it is a change of
 * variable that turns the root into something with no root in it at all, by
 * standing on a Pythagorean identity:
 *
 * | under the root | substitute   | the root becomes | dx          |
 * | -------------- | ------------ | ---------------- | ----------- |
 * | `a² - x²`      | `x = a sinθ` | `a cosθ`         | `a cosθ dθ` |
 * | `a² + x²`      | `x = a tanθ` | `a secθ`         | `a sec²θ dθ`|
 * | `x² - a²`      | `x = a secθ` | `a tanθ`         | `a secθ tanθ dθ` |
 *
 * ## Coming back
 *
 * The hard half, and the half that is usually taught with a drawing. A right
 * triangle is not needed: each substitution fixes every trigonometric function
 * of θ in terms of x and the root, and those are the replacements applied on
 * the way out. For `x = a sinθ`, `sinθ` is `x/a` and `cosθ` is `√(a²-x²)/a`,
 * and θ itself is `arcsin(x/a)`.
 *
 * The one thing that has to happen first is that a doubled angle has to be
 * opened up. Integrating `sin²θ` gives `θ/2 - sin(2θ)/4`, and `sin(2θ)` is not
 * a function of θ this can replace — `2 sinθ cosθ` is, and they are the same
 * thing.
 *
 * ## What it refuses
 *
 * A root whose square term is not the bare variable, and a constant that is not
 * a number. Both are the same restriction the rest of the integrator carries:
 * the sign of the constant chooses between three different substitutions, so it
 * has to be known, and a coefficient on `x²` is a scaling that the ordinary
 * substitution search reaches first and does better.
 *
 * Nothing here can produce a wrong answer by choosing badly: a substitution
 * that does not help produces an integral the rest of the integrator refuses,
 * and the caller checks every result numerically before it is shown.
 */
import {
  add,
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
  replaceIdentifier,
  replaceSubtree,
  subtract,
  visit,
  type Node,
} from "../../../symbolic";

/** One of the three shapes, already recognised. */
interface Form {
  /** The root as it appears in the integrand. */
  root: Node;
  /** `a`, where the constant under the root is `a²`. */
  scale: Node;
  kind: "sine" | "tangent" | "secant";
}

export interface TrigSubstitution {
  /** The integral to do, in the new variable. */
  integrand: Node;
  /** The new variable's name. */
  name: string;
  /** Turns an answer in that variable back into one in the original. */
  back: (node: Node) => Node;
}

/**
 * The substitution for the first root in `node` that fits one of the three
 * shapes, or `undefined` if there is none.
 */
export function findTrigSubstitution(
  node: Node,
  variable: string
): TrigSubstitution | undefined {
  // A half-integer power is a root with something else done to it, and it is
  // written that way constantly: `(1+x^2)^{3/2}` is `sqrt(1+x^2)^3`. Rewritten
  // first, so that everything below has only one shape to look for and the
  // substitution has a subtree it can replace.
  node = asRootPowers(node);
  const form = firstForm(node, variable);
  if (form === undefined) return undefined;
  const name = freshName(node, ["\\theta", "t", "w"]);
  const angle = id(name);
  const { scale, root, kind } = form;

  const a = scale;
  const sin = call("sin", angle);
  const cos = call("cos", angle);
  const tan = call("tan", angle);
  const sec = call("sec", angle);

  const substitution =
    kind === "sine"
      ? { x: multiply(a, sin), root: multiply(a, cos), dx: multiply(a, cos) }
      : kind === "tangent"
        ? {
            x: multiply(a, tan),
            root: multiply(a, sec),
            dx: multiply(a, power(sec, number(2))),
          }
        : {
            x: multiply(a, sec),
            root: multiply(a, tan),
            dx: multiply(a, multiply(sec, tan)),
          };

  // The root is replaced before the variable, or the `x` inside the root would
  // be substituted too and the identity would never be used.
  const withoutRoot = replaceSubtree(node, root, substitution.root);
  const inAngle = replaceIdentifier(withoutRoot, variable, substitution.x);
  // A power of a product distributed over its factors. Substituting
  // `x = 2tanθ` into `x²` gives `(2tanθ)²`, which the fold leaves as it is,
  // and a squared product is not something the trigonometric rules can read as
  // `sin^p cos^q` -- which is why `1/(x²√(x²+4))` was refused while
  // `1/(x²√(x²+1))`, with nothing to square but the tangent, went through.
  const integrand = fold(
    powersOfProducts(fold(multiply(inAngle, substitution.dx)))
  );

  return {
    integrand,
    name,
    back: (answer) => fold(backSubstitute(answer, name, variable, form)),
  };
}

/** `(ab)^n` as `a^n b^n` for an integer `n`, everywhere in the tree. */
function powersOfProducts(node: Node): Node {
  return mapTree(node, (child) => {
    if (child.type !== "BinaryOperator" || child.name !== "Exponent")
      return child;
    const base = child.left;
    const exponent = constantValue(child.right);
    if (
      exponent === undefined ||
      !Number.isInteger(exponent) ||
      base.type !== "BinaryOperator" ||
      (base.name !== "Multiply" && base.name !== "CrossMultiply")
    ) {
      return child;
    }
    return multiply(
      powersOfProducts(power(base.left, child.right)),
      powersOfProducts(power(base.right, child.right))
    );
  });
}

/** `A^{m/2}` for odd m, rewritten as `sqrt(A)^m`. */
function asRootPowers(node: Node): Node {
  return mapTree(node, (child) => {
    if (child.type !== "BinaryOperator" || child.name !== "Exponent")
      return child;
    const exponent = fold(child.right);
    if (
      exponent.type !== "BinaryOperator" ||
      exponent.name !== "Divide" ||
      constantValue(exponent.right) !== 2
    ) {
      return child;
    }
    const top = constantValue(exponent.left);
    if (top === undefined || !Number.isInteger(top) || Math.abs(top) % 2 !== 1)
      return child;
    return {
      type: "BinaryOperator",
      name: "Exponent",
      left: call("sqrt", child.left),
      right: { type: "Constant", value: top },
    };
  });
}

/** The first root in the tree that one of the three substitutions clears. */
function firstForm(node: Node, variable: string): Form | undefined {
  let found: Form | undefined;
  visit(node, (child) => {
    if (found !== undefined) return;
    const form = asForm(child, variable);
    if (form !== undefined) found = form;
  });
  return found;
}

function asForm(node: Node, variable: string): Form | undefined {
  const inside = squareRootArgument(node);
  if (inside === undefined || !dependsOn(inside, variable)) return undefined;

  // `k - x²`, `k + x²` or `x² - k`, and nothing else. The parts are read off
  // the sum rather than solved for, because the three cases are told apart by
  // which side the minus sign is on.
  const parts = splitSquare(inside, variable);
  if (parts === undefined) return undefined;
  const { constant, squareSign, constantSign } = parts;
  const value = constantValue(fold(constant));
  if (value === undefined || value <= 0) return undefined;
  const scale = fold(call("sqrt", number(value)));

  // Three shapes, told apart by which of the two terms carries the minus sign.
  if (squareSign < 0) return { root: node, scale, kind: "sine" };
  if (constantSign > 0) return { root: node, scale, kind: "tangent" };
  return { root: node, scale, kind: "secant" };
}

/** `\sqrt{...}` or `(...)^{1/2}`, as whatever is underneath. */
function squareRootArgument(node: Node): Node | undefined {
  if (
    node.type === "FunctionCall" &&
    node.callee.symbol === "sqrt" &&
    node.args.length === 1
  ) {
    return node.args[0];
  }
  if (node.type === "BinaryOperator" && node.name === "Exponent") {
    const exponent = fold(node.right);
    if (
      exponent.type === "BinaryOperator" &&
      exponent.name === "Divide" &&
      constantValue(exponent.left) === 1 &&
      constantValue(exponent.right) === 2
    ) {
      return node.left;
    }
  }
  return undefined;
}

/**
 * `k ± x²` or `x² - k` taken apart, as the constant and the sign on the square.
 *
 * Only the bare variable squared. A coefficient on it would be a scaling, and
 * the ordinary substitution search reaches that first.
 */
function splitSquare(
  node: Node,
  variable: string
): { constant: Node; squareSign: number; constantSign: number } | undefined {
  if (node.type !== "BinaryOperator") return undefined;
  if (node.name !== "Add" && node.name !== "Subtract") return undefined;
  const sign = node.name === "Add" ? 1 : -1;
  const leftIsSquare = isBareSquare(node.left, variable);
  const rightIsSquare = isBareSquare(node.right, variable);
  if (leftIsSquare && !dependsOn(node.right, variable)) {
    // x² ± k: the tangent case when the constant is added and the secant
    // case when it is taken away.
    return { constant: node.right, squareSign: 1, constantSign: sign };
  }
  if (rightIsSquare && !dependsOn(node.left, variable)) {
    // k ± x². A positive constant with the square taken away is the sine
    // case; with the square added it is the tangent case again.
    return { constant: node.left, squareSign: sign, constantSign: 1 };
  }
  return undefined;
}

function isBareSquare(node: Node, variable: string) {
  return (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    node.left.type === "Identifier" &&
    node.left.symbol === variable &&
    constantValue(node.right) === 2
  );
}

/**
 * An answer in θ, written back in x.
 *
 * Every trigonometric function of θ has a value in terms of x and the root, and
 * they are substituted before θ itself so that `arcsin` only ever appears where
 * a bare angle survived.
 */
function backSubstitute(
  answer: Node,
  name: string,
  variable: string,
  form: Form
): Node {
  const x = id(variable);
  const { scale: a, root, kind } = form;
  const table: Record<string, Node> =
    kind === "sine"
      ? {
          sin: divide(x, a),
          cos: divide(root, a),
          tan: divide(x, root),
          sec: divide(a, root),
          cot: divide(root, x),
          csc: divide(a, x),
        }
      : kind === "tangent"
        ? {
            sin: divide(x, root),
            cos: divide(a, root),
            tan: divide(x, a),
            sec: divide(root, a),
            cot: divide(a, x),
            csc: divide(root, x),
          }
        : {
            sin: divide(root, x),
            cos: divide(a, x),
            tan: divide(root, a),
            sec: divide(x, a),
            cot: divide(a, root),
            csc: divide(x, root),
          };
  const bare: Node =
    kind === "sine"
      ? call("arcsin", divide(x, a))
      : kind === "tangent"
        ? call("arctan", divide(x, a))
        : call("arccos", divide(a, x));

  const opened = openDoubleAngles(answer, name);
  const replaced = replaceTrigCalls(opened, name, table);
  return replaceIdentifier(replaced, name, bare);
}

/**
 * `sin(2θ)` and `cos(2θ)` written in terms of `sinθ` and `cosθ`.
 *
 * Integrating an even power of a sine produces a doubled angle, and a doubled
 * angle is the one function of θ that cannot be replaced one call at a time.
 */
function openDoubleAngles(node: Node, name: string): Node {
  return mapTree(node, (child) => {
    if (child.type !== "FunctionCall" || child.args.length !== 1) return child;
    const which = child.callee.symbol;
    if (which !== "sin" && which !== "cos") return child;
    const inner = fold(child.args[0]);
    if (
      inner.type !== "BinaryOperator" ||
      (inner.name !== "Multiply" && inner.name !== "CrossMultiply")
    ) {
      return child;
    }
    const k = constantValue(inner.left);
    if (k === undefined || !Number.isInteger(k) || k < 2 || k > 8) return child;
    const angle = inner.right;
    if (angle.type !== "Identifier" || angle.symbol !== name) return child;
    // Multiplied out as it goes in, so that the numbers in it meet the
    // coefficient outside: left nested, `sin 4θ / 32` comes back as
    // `2(x√(1-x²))(1-2x²)/16`, with a 2 the fold cannot reach.
    return fold(expand(multipleAngle(which, k, angle)).node);
  });
}

/**
 * `sin(kθ)` or `cos(kθ)` written in `sinθ` and `cosθ`, for a whole `k`.
 *
 * Not only the doubled angle. `∫sin²θcos²θ` is `θ/8 - sin(4θ)/32`, and a
 * `sin(4θ)` left as it is survives the back-substitution as `sin(4 arcsin x)`
 * -- correct, and not something anybody writes. Halving an even multiple and
 * peeling one angle off an odd one reach `sinθ` and `cosθ` in a few steps,
 * and those are exactly what the table replaces.
 */
function multipleAngle(which: "sin" | "cos", k: number, angle: Node): Node {
  const sin = call("sin", angle);
  const cos = call("cos", angle);
  if (k === 1) return which === "sin" ? sin : cos;
  if (k % 2 === 0) {
    const half = k / 2;
    const s = multipleAngle("sin", half, angle);
    const c = multipleAngle("cos", half, angle);
    return which === "sin"
      ? multiply(number(2), multiply(s, c))
      : subtract(number(1), multiply(number(2), power(s, number(2))));
  }
  // sin((k-1)θ + θ) and cos((k-1)θ + θ), by the addition formulas.
  const s = multipleAngle("sin", k - 1, angle);
  const c = multipleAngle("cos", k - 1, angle);
  return which === "sin"
    ? add(multiply(s, cos), multiply(c, sin))
    : subtract(multiply(c, cos), multiply(s, sin));
}

/** Every `f(θ)` for a trigonometric `f`, replaced by its value in x. */
function replaceTrigCalls(
  node: Node,
  name: string,
  table: Record<string, Node>
): Node {
  return mapTree(node, (child) => {
    if (child.type !== "FunctionCall" || child.args.length !== 1) return child;
    const replacement = table[child.callee.symbol];
    if (replacement === undefined) return child;
    const [argument] = child.args;
    if (argument.type !== "Identifier" || argument.symbol !== name)
      return child;
    return replacement;
  });
}

/** Bottom-up rewrite over the shapes an answer can be built from. */
function mapTree(node: Node, on: (child: Node) => Node): Node {
  const rebuilt: Node =
    node.type === "Negative"
      ? { ...node, arg: mapTree(node.arg, on) }
      : node.type === "FunctionCall"
        ? { ...node, args: node.args.map((arg) => mapTree(arg, on)) }
        : node.type === "BinaryOperator"
          ? {
              ...node,
              left: mapTree(node.left, on),
              right: mapTree(node.right, on),
            }
          : node;
  return on(rebuilt);
}

/** Kept for the tests, which check the pieces before the whole. */
export const forTesting = { openDoubleAngles, asForm, add };
