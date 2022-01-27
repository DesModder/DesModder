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

type Latex = RootLatexNode | ChildNode;
export default Latex;

export type RootLatexNode =
  | Equation
  | Assignment
  | FunctionDefinition
  | Visualization
  | Regression;

export type ChildNode =
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
  | And
  | Comparator;

export interface Equation {
  type: "Equation";
  left: ChildNode;
  right: ChildNode;
}

export interface Assignment {
  type: "Assignment";
  left: Identifier;
  right: ChildNode;
}

export interface FunctionDefinition {
  type: "FunctionDefinition";
  symbol: Identifier;
  argSymbols: Identifier[];
  definition: ChildNode;
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
  args: ChildNode[];
}

export interface Regression {
  type: "Regression";
  left: ChildNode;
  right: ChildNode;
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
  args: ChildNode[];
}

export interface Integral {
  // "\\int_{0}^{1}tdt"
  type: "Integral";
  differential: Identifier;
  start: ChildNode;
  end: ChildNode;
  integrand: ChildNode;
}

export interface Derivative {
  // "\\frac{d}{dx}x";
  type: "Derivative";
  arg: ChildNode;
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
  args: ChildNode[];
}

export interface Range {
  type: "Range";
  /*
  For [1...2], start = List[1,] and end = List[2,]
  For [1,2,3,4...9,10,11], start = List[1,2,3,4] and end = List[9,10,11]
  */
  start: ChildNode[];
  end: ChildNode[];
}

export interface ListAccess {
  // "L[1]"
  type: "ListAccess";
  list: ChildNode;
  index: ChildNode;
}

export interface DotAccess {
  // "L.\\operatorname{random}"
  type: "DotAccess";
  object: ChildNode;
  property: Identifier | FunctionCall;
}

export interface OrderedPairAccess {
  // "a.x" or "a.y"
  type: "OrderedPairAccess";
  point: ChildNode;
  index: "x" | "y";
}

export interface Seq {
  // "1,2" or "(1,2)"
  type: "Seq";
  parenWrapped: boolean;
  args: ChildNode[];
}

export interface UpdateRule {
  // "a\\to a+1"
  type: "UpdateRule";
  variable: Identifier;
  expression: ChildNode;
}

export interface AssignmentExpression {
  // "a=[1...5]" inside "for a=[1...5],b=[1...3]"
  type: "AssignmentExpression";
  variable: Identifier;
  expression: ChildNode;
}

export interface ListComprehension {
  type: "ListComprehension";
  // we don't include the comprehension index
  expr: ChildNode;
  assignments: AssignmentExpression[];
}

export interface Piecewise {
  // A large piecewise is represented by another piecewise in the alternate
  type: "Piecewise";
  condition: Comparator | And;
  consequent: ChildNode;
  alternate: ChildNode;
}

export interface RepeatedOperator {
  type: "RepeatedOperator";
  name: "Product" | "Sum";
  index: Identifier;
  start: ChildNode;
  end: ChildNode;
  expression: ChildNode;
}

export interface BinaryOperator {
  type: "BinaryOperator";
  name: "Add" | "Subtract" | "Multiply" | "Divide" | "Exponent";
  left: ChildNode;
  right: ChildNode;
}

export interface Negative {
  type: "Negative";
  arg: ChildNode;
}

export interface And {
  // double inequality
  // n.left.right == n.right.left
  type: "And";
  left: Comparator;
  right: Comparator;
}

export interface Comparator {
  type: "Comparator";
  symbol: "<" | "<=" | "=" | ">=" | ">";
  left: ChildNode;
  right: ChildNode;
}
