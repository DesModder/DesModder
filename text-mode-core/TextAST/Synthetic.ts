import { Synthetic } from ".";
import { TextAST } from "..";

export type Program = TextAST.Program<Synthetic>;
export type Statement = TextAST.Statement<Synthetic>;
export type ExprStatement = TextAST.ExprStatement<Synthetic>;
export type Table = TextAST.Table<Synthetic>;
export type TableColumn = TextAST.TableColumn<Synthetic>;
export type Image = TextAST.Image<Synthetic>;
export type Text = TextAST.Text<Synthetic>;
export type Folder = TextAST.Folder<Synthetic>;
export type Settings = TextAST.Settings<Synthetic>;
export type Ticker = TextAST.Ticker<Synthetic>;
export type RegressionParameters = TextAST.RegressionParameters<Synthetic>;
export type RegressionEntry = TextAST.RegressionEntry<Synthetic>;
export type StyleMapping = TextAST.StyleMapping<Synthetic>;
export type MappingEntry = TextAST.MappingEntry<Synthetic>;
export type Expression = TextAST.Expression<Synthetic>;
export type NumberNode = TextAST.NumberNode<Synthetic>;
export type Identifier = TextAST.Identifier<Synthetic>;
export type StringNode = TextAST.StringNode<Synthetic>;
export type RepeatedExpression = TextAST.RepeatedExpression<Synthetic>;
export type RangeExpression = TextAST.RangeExpression<Synthetic>;
export type ListExpression = TextAST.ListExpression<Synthetic>;
export type ListComprehension = TextAST.ListComprehension<Synthetic>;
export type IntervalParameter = TextAST.IntervalParameter<Synthetic>;
export type Substitution = TextAST.Substitution<Synthetic>;
export type AssignmentExpression = TextAST.AssignmentExpression<Synthetic>;
export type PiecewiseExpression = TextAST.PiecewiseExpression<Synthetic>;
export type PiecewiseBranch = TextAST.PiecewiseBranch<Synthetic>;
export type PrefixExpression = TextAST.PrefixExpression<Synthetic>;
export type UpdateRule = TextAST.UpdateRule<Synthetic>;
export type SequenceExpression = TextAST.SequenceExpression<Synthetic>;
export type MemberExpression = TextAST.MemberExpression<Synthetic>;
export type ListAccessExpression = TextAST.ListAccessExpression<Synthetic>;
export type CompareOp = TextAST.CompareOp;
export type BinaryExpression = TextAST.BinaryExpression<Synthetic>;
export type PostfixExpression = TextAST.PostfixExpression<Synthetic>;
export type CallExpression = TextAST.CallExpression<Synthetic>;
export type PrimeExpression = TextAST.PrimeExpression<Synthetic>;
export type DerivativeExpression = TextAST.DerivativeExpression<Synthetic>;
export type Positioned = TextAST.Positioned<Synthetic>;
export type NonExprNode = TextAST.NonExprNode<Synthetic>;
export type NonExprNonStatementNode =
  TextAST.NonExprNonStatementNode<Synthetic>;
export type Node = TextAST.Node<Synthetic>;

export class NodePath<T extends Node = Node> extends TextAST.NodePath<
  Synthetic,
  T
> {}

export function number(val: number): NumberNode {
  return {
    type: "Number",
    value: val,
  };
}
