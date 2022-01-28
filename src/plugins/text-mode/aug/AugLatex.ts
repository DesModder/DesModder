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

type Latex = RootLatex | ChildLatex;
export default Latex;

export type RootLatex =
  | Equation
  | Assignment
  | FunctionDefinition
  | Visualization
  | Regression;

export type ChildLatex =
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
  | AssignmentExpression
  | ListComprehension
  | Piecewise
  | RepeatedOperator
  | BinaryOperator
  | Negative
  | Comparator
  | DoubleInequality;

export interface Equation {
  type: "Equation";
  left: ChildLatex;
  right: ChildLatex;
}

export interface Assignment {
  type: "Assignment";
  left: Identifier;
  right: ChildLatex;
}

export interface FunctionDefinition {
  type: "FunctionDefinition";
  symbol: Identifier;
  argSymbols: Identifier[];
  definition: ChildLatex;
}

export interface Visualization {
  type: "Visualization";
  callee: {
    type: "Identifier";
    symbol:
      | "Stats"
      | "BoxPlot"
      | "DotPlot"
      | "Histogram"
      | "IndependentTTest"
      | "TTest";
  };
  args: ChildLatex[];
}

export interface Regression {
  type: "Regression";
  left: ChildLatex;
  right: ChildLatex;
}

export interface Constant {
  type: "Constant";
  value: number;
}

export interface Identifier {
  // "a"
  type: "Identifier";
  /**
   * Symbols are stored as a symbol. Three main cases:
   *  - one-character name like "a"
   *  - long name like "random"
   *  - greek name like "delta"
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
  // absolute value and factorial are both included in FunctionCall
  type: "FunctionCall";
  callee: Identifier;
  args: ChildLatex[];
}

export interface Integral {
  // "\\int_{0}^{1}tdt"
  type: "Integral";
  differential: Identifier;
  start: ChildLatex;
  end: ChildLatex;
  integrand: ChildLatex;
}

export interface Derivative {
  // "\\frac{d}{dx}x";
  type: "Derivative";
  arg: ChildLatex;
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
  args: ChildLatex[];
}

export interface Range {
  type: "Range";
  /*
  For [1...2], start = List[1,] and end = List[2,]
  For [1,2,3,4...9,10,11], start = List[1,2,3,4] and end = List[9,10,11]
  */
  start: ChildLatex[];
  end: ChildLatex[];
}

export interface ListAccess {
  // "L[1]"
  type: "ListAccess";
  list: ChildLatex;
  index: ChildLatex;
}

export interface DotAccess {
  // "L.\\operatorname{random}"
  type: "DotAccess";
  object: ChildLatex;
  property: Identifier | FunctionCall;
}

export interface OrderedPairAccess {
  // "a.x" or "a.y"
  type: "OrderedPairAccess";
  point: ChildLatex;
  index: "x" | "y";
}

export interface Seq {
  // "1,2" or "(1,2)"
  type: "Seq";
  parenWrapped: boolean;
  args: ChildLatex[];
}

export interface UpdateRule {
  // "a\\to a+1"
  type: "UpdateRule";
  variable: Identifier;
  expression: ChildLatex;
}

export interface AssignmentExpression {
  // "a=[1...5]" inside "for a=[1...5],b=[1...3]"
  type: "AssignmentExpression";
  variable: Identifier;
  expression: ChildLatex;
}

export interface ListComprehension {
  type: "ListComprehension";
  // we don't include the comprehension index
  expr: ChildLatex;
  assignments: AssignmentExpression[];
}

export interface Piecewise {
  // A large piecewise is represented by another piecewise in the alternate
  type: "Piecewise";
  condition: Comparator | DoubleInequality;
  consequent: ChildLatex;
  alternate: ChildLatex;
}

export interface RepeatedOperator {
  type: "RepeatedOperator";
  name: "Product" | "Sum";
  index: Identifier;
  start: ChildLatex;
  end: ChildLatex;
  expression: ChildLatex;
}

export interface BinaryOperator {
  type: "BinaryOperator";
  name: "Add" | "Subtract" | "Multiply" | "Divide" | "Exponent";
  left: ChildLatex;
  right: ChildLatex;
}

export interface Negative {
  type: "Negative";
  arg: ChildLatex;
}

type ComparatorSymbol = "<" | "<=" | "=" | ">=" | ">";

export interface DoubleInequality {
  type: "DoubleInequality";
  left: ChildLatex;
  leftOperator: ComparatorSymbol;
  middle: ChildLatex;
  rightOperator: ComparatorSymbol;
  right: ChildLatex;
}

export interface Comparator {
  type: "Comparator";
  left: ChildLatex;
  operator: ComparatorSymbol;
  right: ChildLatex;
}

export function isConstant(e: Latex, v: number) {
  return (
    e.type === "Constant" && (e.value === v || (isNaN(e.value) && isNaN(v)))
  );
}
