import * as TextAST from "./TextAST";

export default TextAST;

export interface Program extends Positioned {
  type: "Program";
  children: Statement[];
}

export type Statement =
  | ExprStatement
  | Table
  | Image
  | Text
  | Folder
  | Settings
  | Ticker;

export interface ExprStatement extends Positioned, Styled {
  type: "ExprStatement";
  expr: Expression;
  /**
   * Data for regression. Not in style mapping because identifiers get
   * evaluated in style mapping. Also mapping keys are strings, not identifiers
   */
  regression?: RegressionData;
}

export interface RegressionData {
  parameters: RegressionParameters;
  residualVariable?: Identifier;
}

export interface Table extends Positioned, Styled {
  type: "Table";
  columns: TableColumn[];
}

export type TableColumn = ExprStatement;

export interface Image extends Positioned, Styled {
  type: "Image";
  name: string;
}

export interface Text extends Positioned, Styled {
  type: "Text";
  text: string;
}

export interface Folder extends Positioned, Styled {
  type: "Folder";
  title: string;
  children: Statement[];
}

export interface Settings extends Positioned, Styled {
  type: "Settings";
}

export interface Ticker extends Positioned, Styled {
  type: "Ticker";
  handler: Expression;
}

export interface RegressionParameters extends Positioned {
  type: "RegressionParameters";
  entries: RegressionEntry[];
}

export interface RegressionEntry extends Positioned {
  type: "RegressionEntry";
  variable: Identifier;
  value: Expression;
}

export interface StyleMapping extends Positioned {
  type: "StyleMapping";
  entries: MappingEntry[];
}

export interface MappingEntry extends Positioned {
  type: "MappingEntry";
  property: StringNode;
  expr: Expression | StyleMapping;
}

export type Expression =
  | NumberNode
  | Identifier
  | StringNode
  | RepeatedExpression
  | RangeExpression
  | ListExpression
  | ListComprehension
  | PiecewiseExpression
  | PrefixExpression
  | SequenceExpression
  | UpdateRule
  | MemberExpression
  | ListAccessExpression
  | BinaryExpression
  | DoubleInequality
  | PostfixExpression
  | CallExpression
  | PrimeExpression
  | DerivativeExpression;

export interface NumberNode extends Positioned {
  type: "Number";
  value: number;
}

export interface Identifier extends Positioned {
  type: "Identifier";
  name: string;
}

export interface StringNode extends Positioned {
  type: "String";
  value: string;
}

export interface RepeatedExpression extends Positioned {
  type: "RepeatedExpression";
  name: "integral" | "sum" | "product";
  index: Identifier;
  start: Expression;
  end: Expression;
  expr: Expression;
}

export interface RangeExpression extends Positioned {
  type: "RangeExpression";
  startValues: Expression[];
  endValues: Expression[];
}

export interface ListExpression extends Positioned {
  type: "ListExpression";
  values: Expression[];
}

export interface ListComprehension extends Positioned {
  type: "ListComprehension";
  expr: Expression;
  assignments: AssignmentExpression[];
}

export interface AssignmentExpression extends Positioned {
  type: "AssignmentExpression";
  variable: Identifier;
  expr: Expression;
}

export interface PiecewiseExpression extends Positioned {
  type: "PiecewiseExpression";
  branches: PiecewiseBranch[];
}

export interface PiecewiseBranch extends Positioned {
  type: "PiecewiseBranch";
  condition: Expression;
  consequent: Expression;
}

export interface PrefixExpression extends Positioned {
  type: "PrefixExpression";
  op: "-";
  expr: Expression;
}

export interface UpdateRule extends Positioned {
  type: "UpdateRule";
  variable: Identifier;
  expr: Expression;
}

export interface SequenceExpression extends Positioned {
  type: "SequenceExpression";
  left: Expression;
  right: Expression;
  parenWrapped: boolean;
}

export interface MemberExpression extends Positioned {
  type: "MemberExpression";
  object: Expression;
  property: Identifier;
}

export interface ListAccessExpression extends Positioned {
  type: "ListAccessExpression";
  expr: Expression;
  index: Expression;
}

type CompareOp = "<" | "<=" | ">=" | ">" | "=";

export interface BinaryExpression extends Positioned {
  type: "BinaryExpression";
  op: "~" | "^" | "/" | "*" | "+" | "-" | CompareOp;
  left: Expression;
  right: Expression;
}

export interface DoubleInequality extends Positioned {
  type: "DoubleInequality";
  left: Expression;
  leftOp: CompareOp;
  middle: Expression;
  rightOp: CompareOp;
  right: Expression;
}

export interface PostfixExpression extends Positioned {
  type: "PostfixExpression";
  op: "factorial";
  expr: Expression;
}

export interface CallExpression extends Positioned {
  type: "CallExpression";
  callee: Expression;
  arguments: Expression[];
}

export interface PrimeExpression extends Positioned {
  type: "PrimeExpression";
  expr: CallExpression;
  order: number;
}

export interface DerivativeExpression extends Positioned {
  type: "DerivativeExpression";
  expr: Expression;
  variable: Identifier;
}

interface Positioned {
  /** pos should be defined for all nodes that come from the text via the CST */
  pos?: Pos;
}

export interface Pos {
  from: number;
  to: number;
}

interface Styled {
  style: StyleMapping | null;
}

/* Builders */

export function number(val: number): NumberNode {
  return {
    type: "Number",
    value: val,
  };
}

/* Path */

export type NonExprNode =
  | Program
  | Statement
  | RegressionParameters
  | RegressionEntry
  | StyleMapping
  | MappingEntry
  | AssignmentExpression
  | PiecewiseBranch;

export type Node = NonExprNode | Expression;

export class NodePath<T extends Node = Node> {
  constructor(
    public node: T,
    public parentPath: NodePath | null,
    public name?: string | number
  ) {}

  get parent() {
    return this.parentPath ? this.parentPath.node : null;
  }

  withChild<U extends Node>(node: U, name: string | number): NodePath<U> {
    return new NodePath<U>(node, this, name);
  }
}
