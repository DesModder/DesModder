/**
 * The latex tree described here can represent different latex strings
 * in the same way, but we assume they are the most specific possible. For
 * example, "f(x)=5x" is a FunctionDefinition rather than a Comparator["="]
 *
 * For simplicity, a few node types are excluded compared to the types
 * from src/parsing/parsenode:
 *  - MixedNumber
 *  - SeededFunctionCall
 *  - FunctionExponent
 *  - FunctionFactorial
 */

export type AnyRootOrChild = AnyRoot | AnyChild;

export type AnyRoot =
  | Equation
  | Assignment
  | FunctionDefinition
  | Visualization
  | Regression;

export type AnyChild =
  | Constant
  | FunctionCall
  | Identifier // This includes ans
  | Integral
  | Derivative
  | Prime
  | List
  | Range
  | ListAccess
  | DotAccess
  | OrderedPairAccess
  | Seq
  | UpdateRule
  | ListComprehension
  | Substitution
  | Piecewise
  | RepeatedOperator
  | BinaryOperator
  | Negative
  | Norm
  | Factorial
  | Comparator
  | DoubleInequality
  | AssignmentExpression;

export interface Equation {
  type: "Equation";
  left: AnyChild;
  right: AnyChild;
}

export interface Assignment {
  type: "Assignment";
  left: Identifier;
  right: AnyChild;
}

export interface FunctionDefinition {
  type: "FunctionDefinition";
  symbol: Identifier;
  argSymbols: Identifier[];
  definition: AnyChild;
}

export interface Visualization {
  type: "Visualization";
  callee: {
    type: "Identifier";
    symbol:
      | "stats"
      | "boxplot"
      | "dotplot"
      | "histogram"
      | "IndependentTTest"
      | "TTest";
  };
  args: AnyChild[];
}

export interface Regression {
  type: "Regression";
  left: AnyChild;
  right: AnyChild;
}

export interface Constant {
  type: "Constant";
  /** Reminder: value can be NaN, for e.g. empty table entries */
  value: number;
}

export interface Identifier {
  // "a"
  type: "Identifier";
  /**
   * Symbols are stored as a symbol. Three main cases:
   *  - one-character name like "a"
   *  - operatorname, e.g. "random" -> \operatorname{random}
   *  - backslash command, e.g. "theta" -> \theta, and "min" -> \min
   * Each of these can be optionally followed by an underscore
   * and one or more letters/digits. Sometimes there are curly braces
   * (example?), but these should be ignored
   *  - "a_123"
   *  - "random_abc"
   *  - "delta_ABC"
   */
  symbol: string;
}

export interface FunctionCall {
  // absolute value is included in FunctionCall
  type: "FunctionCall";
  callee: Identifier;
  args: AnyChild[];
}

export interface Integral {
  // "\\int_{0}^{1}tdt"
  type: "Integral";
  differential: Identifier;
  start: AnyChild;
  end: AnyChild;
  integrand: AnyChild;
}

export interface Derivative {
  // "\\frac{d}{dx}x";
  type: "Derivative";
  arg: AnyChild;
  variable: Identifier;
}

export interface Prime {
  // "f''(x)"; always one argument
  type: "Prime";
  arg: FunctionCall;
  order: number;
}

export interface List {
  // "[1,2,3]"
  type: "List";
  args: AnyChild[];
}

export interface Range {
  type: "Range";
  /*
  For [1...2], start = List[1,] and end = List[2,]
  For [1,2,3,4...9,10,11], start = List[1,2,3,4] and end = List[9,10,11]
  */
  start: AnyChild[];
  end: AnyChild[];
}

export interface ListAccess {
  // "L[1]"
  type: "ListAccess";
  list: AnyChild;
  index: AnyChild;
}

export interface DotAccess {
  // "L.\\operatorname{random}"
  type: "DotAccess";
  object: AnyChild;
  property: Identifier | FunctionCall;
}

export interface OrderedPairAccess {
  // "a.x" or "a.y"
  type: "OrderedPairAccess";
  point: AnyChild;
  index: "x" | "y";
}

export interface Seq {
  // "1,2" or "(1,2)"
  type: "Seq";
  parenWrapped: boolean;
  args: AnyChild[];
}

export interface UpdateRule {
  // "a\\to a+1"
  type: "UpdateRule";
  variable: Identifier;
  expression: AnyChild;
}

export interface AssignmentExpression {
  // "a=[1...5]" inside "for a=[1...5],b=[1...3]"
  type: "AssignmentExpression";
  variable: Identifier;
  expression: AnyChild;
}

export interface ListComprehension {
  type: "ListComprehension";
  // we don't include the comprehension index
  expr: AnyChild;
  assignments: AssignmentExpression[];
}

export interface Substitution {
  type: "Substitution";
  body: AnyChild;
  assignments: AssignmentExpression[];
}

export interface Piecewise {
  // A large piecewise is represented by another piecewise in the alternate
  type: "Piecewise";
  condition: Comparator | DoubleInequality | true;
  consequent: AnyChild;
  alternate: AnyChild;
}

export interface RepeatedOperator {
  type: "RepeatedOperator";
  name: "Product" | "Sum";
  index: Identifier;
  start: AnyChild;
  end: AnyChild;
  expression: AnyChild;
}

export interface BinaryOperator {
  type: "BinaryOperator";
  name: "Add" | "Subtract" | "Multiply" | "Divide" | "Exponent";
  left: AnyChild;
  right: AnyChild;
}

export interface Negative {
  type: "Negative";
  arg: AnyChild;
}

export interface Norm {
  type: "Norm";
  arg: AnyChild;
}

export interface Factorial {
  type: "Factorial";
  arg: AnyChild;
}

type ComparatorSymbol = "<" | "<=" | "=" | ">=" | ">";

export interface DoubleInequality {
  type: "DoubleInequality";
  left: AnyChild;
  leftOperator: ComparatorSymbol;
  middle: AnyChild;
  rightOperator: ComparatorSymbol;
  right: AnyChild;
}

export interface Comparator {
  type: "Comparator";
  left: AnyChild;
  operator: ComparatorSymbol;
  right: AnyChild;
}

export function isConstant(e: AnyRootOrChild | undefined, v: number) {
  return (
    e &&
    e.type === "Constant" &&
    (e.value === v || (isNaN(e.value) && isNaN(v)))
  );
}

export function constant(value: number): Constant {
  return { type: "Constant", value };
}
