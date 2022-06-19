export type Program = Statement[];

export type Statement =
  | ShowStatement
  | LetStatement
  | FunctionDefinition
  | RegressionStatement
  | Table
  | Image
  | Text
  | Folder
  | Settings;

export interface ShowStatement extends Positioned {
  type: "ShowStatement";
  expr: Expression;
  style: StyleMapping;
}

export interface LetStatement extends Positioned {
  type: "LetStatement";
  identifier: Identifier;
  expr: Expression;
  style: StyleMapping;
}

export interface FunctionDefinition extends Positioned {
  type: "FunctionDefinition";
  callee: Identifier;
  params: Identifier[];
  expr: Expression;
  style: StyleMapping;
}

export interface RegressionStatement extends Positioned {
  type: "RegressionStatement";
  expr: RegressionExpression;
  style: StyleMapping;
  body?: {
    residualVariable: Identifier;
    regressionParameters: Map<Identifier, Expression>;
  };
}

export interface RegressionExpression extends Positioned {
  type: "RegressionExpression";
  left: Expression;
  right: Expression;
}

export interface Table extends Positioned {
  type: "Table";
  columns: TableColumn[];
  style: StyleMapping;
}

export type TableColumn = ShowStatement | LetStatement;

export interface Image extends Positioned {
  type: "Image";
  name: string;
  url: string;
  style: StyleMapping;
}

export interface Text extends Positioned {
  type: "Text";
  text: string;
  style: StyleMapping;
}

export interface Folder extends Positioned {
  type: "Folder";
  title: string;
  children: Statement[];
  style: StyleMapping;
}

export interface Settings extends Positioned {
  type: "Settings";
  style: StyleMapping;
}

export type StyleMapping = StyleMappingFilled | null;

export interface StyleMappingFilled extends Positioned {
  type: "StyleMapping";
  entries: MappingEntry[];
}

export interface MappingEntry extends Positioned {
  type: "MappingEntry";
  property: String;
  expr: Expression | StyleMappingFilled;
}

export type Expression =
  | Number
  | Identifier
  | String
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
  | PostfixExpression
  | CallExpression
  // TODO: RegressionExpression here is temporary because it should not be a child
  | RegressionExpression;

export interface Number extends Positioned {
  type: "Number";
  value: number;
}

export interface Identifier extends Positioned {
  type: "Identifier";
  name: string;
}

export interface String extends Positioned {
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
  op: "negative";
  expr: Expression;
}

export interface UpdateRule extends Positioned {
  type: "UpdateRule";
  variable: Identifier;
  expression: Expression;
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

export interface BinaryExpression extends Positioned {
  type: "BinaryExpression";
  op: "^" | "/" | "*" | "+" | "-" | "<" | "<=" | ">=" | ">" | "=";
  left: Expression;
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

interface Positioned {
  /* pos should be defined for all nodes that come from the text via the CST */
  pos?: Pos;
}

export interface Pos {
  from: number;
  to: number;
}

/* Builders */

export function number(val: number): Number {
  return {
    type: "Number",
    value: val,
  };
}
