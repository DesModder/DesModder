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

export interface ShowStatement {
  type: "ShowStatement";
  expr: Expression;
  show: boolean;
  style: StyleMapping;
}

export interface LetStatement {
  type: "LetStatement";
  identifier: Identifier;
  expr: Expression;
  style: StyleMapping;
}

export interface FunctionDefinition {
  type: "FunctionDefinition";
  callee: Identifier;
  params: Identifier[];
  expr: Expression;
  style: StyleMapping;
}

export interface RegressionStatement {
  type: "RegressionStatement";
  left: Expression;
  right: Expression;
  style: StyleMapping;
}

export interface Table {
  type: "Table";
  columns: TableColumn[];
  style: StyleMapping;
}

export interface TableColumn {
  type: "TableColumn";
  show: boolean;
  assignment: Identifier | null;
  style: StyleMapping;
}

export interface Image {
  type: "Image";
  name: string;
  url: string;
  style: StyleMapping;
}

export interface Text {
  type: "Text";
  text: string;
  style: StyleMapping;
}

export interface Folder {
  type: "Folder";
  name: string;
  children: Statement[];
  style: StyleMapping;
}

export interface Settings {
  type: "Settings";
  style: StyleMapping;
}

export type StyleMapping = StyleMappingFilled | null;

export interface StyleMappingFilled {
  type: "StyleMapping";
  entries: MappingEntry[];
}

export interface MappingEntry {
  type: "MappingEntry";
  property: string;
  expr: Expression | StyleMapping;
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
  | CallExpression;

export interface Number {
  type: "Number";
  value: number;
}

export interface Identifier {
  type: "Identifier";
  name: string;
}

export interface String {
  type: "String";
  value: string;
}

export interface RepeatedExpression {
  type: "RepeatedExpression";
  name: "integral" | "sum" | "product";
  index: Identifier;
  start: Expression;
  end: Expression;
  expr: Expression;
}

export interface RangeExpression {
  type: "RangeExpression";
  startValues: Expression[];
  endValues: Expression[];
}

export interface ListExpression {
  type: "ListExpression";
  values: Expression[];
}

export interface ListComprehension {
  type: "ListComprehension";
  expr: Expression;
  assignments: AssignmentExpression[];
}

export interface AssignmentExpression {
  type: "AssignmentExpression";
  variable: Identifier;
  expr: Expression;
}

export interface PiecewiseExpression {
  type: "PiecewiseExpression";
  branches: PiecewiseBranch[];
}

export interface PiecewiseBranch {
  type: "PiecewiseBranch";
  condition: Expression;
  consequent: Expression;
}

export interface PrefixExpression {
  type: "PrefixExpression";
  op: "negative";
  expr: Expression;
}

export interface UpdateRule {
  type: "UpdateRule";
  variable: Expression;
  expression: Expression;
}

export interface SequenceExpression {
  type: "SequenceExpression";
  left: Expression;
  right: Expression;
  parenWrapped: boolean;
}

export interface MemberExpression {
  type: "MemberExpression";
  object: Expression;
  property: Identifier;
}

export interface ListAccessExpression {
  type: "ListAccessExpression";
  expr: Expression;
  index: Expression;
}

export interface BinaryExpression {
  type: "BinaryExpression";
  op: "^" | "/" | "*" | "+" | "-" | "<" | "<=" | ">=" | ">" | "=";
  left: Expression;
  right: Expression;
}

export interface PostfixExpression {
  type: "PostfixExpression";
  op: "factorial";
  expr: Expression;
}

export interface CallExpression {
  type: "CallExpression";
  callee: Expression;
  arguments: Expression[];
}
