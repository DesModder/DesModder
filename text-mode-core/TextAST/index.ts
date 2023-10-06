import * as TextAST from ".";

export default TextAST;

/* Generic */

/**
 * We maintain effectively two ASTs. One is intended for ASTs sourced from
 * string/CST; this holds positions and more. Another is is for synthetic nodes
 * etc. The branching is based on type argument. The first type argument is C.
 * If C is "concrete", then add in the concrete properties. Otherwise don't.
 */

const synthetic = "synthetic";
export type Synthetic = typeof synthetic;
const concrete = "concrete";
export type Concrete = typeof concrete;
type S = Synthetic | Concrete;

/* Nodes */

export type Program<C extends S = Concrete> = Positioned<C> & {
  type: "Program";
  children: Statement<C>[];
};

type StatementBase<C extends S = Concrete> = Positioned<C> &
  Styled<C> &
  (C extends Concrete
    ? {
        id: string;
        index: number;
      }
    : // eslint-disable-next-line @typescript-eslint/ban-types
      {});

export type Statement<C extends S = Concrete> =
  | ExprStatement<C>
  | Table<C>
  | Image<C>
  | Text<C>
  | Folder<C>
  | Settings<C>
  | Ticker<C>;

export type ExprStatement<C extends S = Concrete> = StatementBase<C> & {
  type: "ExprStatement";
  expr: Expression<C>;
  /**
   * Data for regression. Not in style mapping because identifiers get
   * evaluated in style mapping. Also mapping keys are strings, not identifiers
   */
  parameters?: RegressionParameters<C>;
  residualVariable?: Identifier<C>;
};

export type Table<C extends S = Concrete> = StatementBase<C> &
  HasChildren<C> & {
    type: "Table";
    columns: TableColumn<C>[];
  };

export type TableColumn<C extends S = Concrete> = ExprStatement<C>;

export type Image<C extends S = Concrete> = StatementBase<C> & {
  type: "Image";
  name: string;
};

export type Text<C extends S = Concrete> = StatementBase<C> & {
  type: "Text";
  text: string;
};

export type Folder<C extends S = Concrete> = StatementBase<C> &
  HasChildren<C> & {
    type: "Folder";
    title: string;
    children: Statement<C>[];
  };

export type Settings<C extends S = Concrete> = StatementBase<C> & {
  type: "Settings";
};

export type Ticker<C extends S = Concrete> = StatementBase<C> & {
  type: "Ticker";
  handler: Expression<C>;
};

export type RegressionParameters<C extends S = Concrete> = Positioned<C> & {
  type: "RegressionParameters";
  entries: RegressionEntry<C>[];
};

export type RegressionEntry<C extends S = Concrete> = Positioned<C> & {
  type: "RegressionEntry";
  variable: Identifier<C>;
  value: Expression<C>;
};

export type StyleMapping<C extends S = Concrete> = Positioned<C> & {
  type: "StyleMapping";
  entries: MappingEntry<C>[];
};

export type MappingEntry<C extends S = Concrete> = Positioned<C> & {
  type: "MappingEntry";
  property: StringNode<C>;
  expr: Expression<C> | StyleMapping<C>;
};

export type Expression<C extends S = Concrete> =
  | NumberNode<C>
  | Identifier<C>
  | StringNode<C>
  | RepeatedExpression<C>
  | RangeExpression<C>
  | ListExpression<C>
  | ListComprehension<C>
  | Substitution<C>
  | AssignmentExpression<C>
  | PiecewiseExpression<C>
  | PrefixExpression<C>
  | Norm<C>
  | SequenceExpression<C>
  | UpdateRule<C>
  | MemberExpression<C>
  | ListAccessExpression<C>
  | BinaryExpression<C>
  | DoubleInequality<C>
  | PostfixExpression<C>
  | CallExpression<C>
  | PrimeExpression<C>
  | DerivativeExpression<C>;

export type NumberNode<C extends S = Concrete> = Positioned<C> & {
  type: "Number";
  value: number;
};

export type Identifier<C extends S = Concrete> = Positioned<C> & {
  type: "Identifier";
  name: string;
};

export type StringNode<C extends S = Concrete> = Positioned<C> & {
  type: "String";
  value: string;
};

export type RepeatedExpression<C extends S = Concrete> = Positioned<C> & {
  type: "RepeatedExpression";
  name: "integral" | "sum" | "product";
  index: Identifier<C>;
  start: Expression<C>;
  end: Expression<C>;
  expr: Expression<C>;
};

export type RangeExpression<C extends S = Concrete> = Positioned<C> & {
  type: "RangeExpression";
  startValues: Expression<C>[];
  endValues: Expression<C>[];
};

export type ListExpression<C extends S = Concrete> = Positioned<C> & {
  type: "ListExpression";
  values: Expression<C>[];
};

export type ListComprehension<C extends S = Concrete> = Positioned<C> & {
  type: "ListComprehension";
  expr: Expression<C>;
  assignments: AssignmentExpression<C>[];
};

export type Substitution<C extends S = Concrete> = Positioned<C> & {
  type: "Substitution";
  body: Expression<C>;
  assignments: AssignmentExpression<C>[];
};

export type AssignmentExpression<C extends S = Concrete> = Positioned<C> & {
  type: "AssignmentExpression";
  variable: Identifier<C>;
  expr: Expression<C>;
};

export type PiecewiseExpression<C extends S = Concrete> = Positioned<C> & {
  type: "PiecewiseExpression";
  branches: PiecewiseBranch<C>[];
};

export type PiecewiseBranch<C extends S = Concrete> = Positioned<C> & {
  type: "PiecewiseBranch";
} & (
    | {
        condition: Expression<C>;
        consequent: Expression<C>;
      }
    | {
        /** null represents "else"/"otherwise"/"always" */
        condition: null;
        consequent: Expression<C>;
      }
    | {
        condition: Expression<C>;
        /** null represents 1 */
        consequent: null;
      }
  );

export type PrefixExpression<C extends S = Concrete> = Positioned<C> & {
  type: "PrefixExpression";
  op: "-";
  expr: Expression<C>;
};

export type Norm<C extends S = Concrete> = Positioned<C> & {
  type: "Norm";
  expr: Expression<C>;
};

export type UpdateRule<C extends S = Concrete> = Positioned<C> & {
  type: "UpdateRule";
  variable: Identifier<C>;
  expr: Expression<C>;
};

export type SequenceExpression<C extends S = Concrete> = Positioned<C> & {
  type: "SequenceExpression";
  left: Expression<C>;
  right: Expression<C>;
  parenWrapped: boolean;
};

export type MemberExpression<C extends S = Concrete> = Positioned<C> & {
  type: "MemberExpression";
  object: Expression<C>;
  property: Identifier<C>;
};

export type ListAccessExpression<C extends S = Concrete> = Positioned<C> & {
  type: "ListAccessExpression";
  expr: Expression<C>;
  index: Expression<C>;
};

export type CompareOp = "<" | "<=" | ">=" | ">" | "=";

export type BinaryExpression<C extends S = Concrete> = Positioned<C> & {
  type: "BinaryExpression";
  op: "~" | "^" | "/" | "*" | "+" | "-" | CompareOp;
  left: Expression<C>;
  right: Expression<C>;
};

export type DoubleInequality<C extends S = Concrete> = Positioned<C> & {
  type: "DoubleInequality";
  left: Expression<C>;
  leftOp: CompareOp;
  middle: Expression<C>;
  rightOp: CompareOp;
  right: Expression<C>;
};

export type PostfixExpression<C extends S = Concrete> = Positioned<C> & {
  type: "PostfixExpression";
  op: "factorial";
  expr: Expression<C>;
};

export type CallExpression<C extends S = Concrete> = Positioned<C> & {
  type: "CallExpression";
  callee: Expression<C>;
  arguments: Expression<C>[];
};

export type PrimeExpression<C extends S = Concrete> = Positioned<C> & {
  type: "PrimeExpression";
  expr: CallExpression<C>;
  order: number;
};

export type DerivativeExpression<C extends S = Concrete> = Positioned<C> & {
  type: "DerivativeExpression";
  expr: Expression<C>;
  variable: Identifier<C>;
};

export type Positioned<C extends S = Concrete> = C extends Concrete
  ? {
      pos: Pos;
    }
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {};

export type HasChildren<C extends S = Concrete> = C extends Concrete
  ? {
      afterOpen: number;
    }
  : // eslint-disable-next-line @typescript-eslint/ban-types
    {};

export interface Pos {
  from: number;
  to: number;
}

interface Styled<C extends S = Concrete> {
  style: StyleMapping<C> | null;
}

/* Path */

export type NonExprNode<C extends S = Concrete> =
  | Statement<C>
  | NonExprNonStatementNode<C>;

export type NonExprNonStatementNode<C extends S = Concrete> =
  | Program<C>
  | RegressionParameters<C>
  | RegressionEntry<C>
  | StyleMapping<C>
  | MappingEntry<C>
  | AssignmentExpression<C>
  | PiecewiseBranch<C>;

export type Node<C extends S = Concrete> =
  | NonExprNode<C>
  | NonExprNonStatementNode<C>
  | Expression<C>;

export function isExpression<C extends S = Concrete>(
  n: Node<C>
): n is Expression<C> {
  if (isStatement(n)) return false;
  switch (n.type) {
    case "Program":
    case "RegressionParameters":
    case "RegressionEntry":
    case "StyleMapping":
    case "MappingEntry":
    case "AssignmentExpression":
    case "PiecewiseBranch":
      n satisfies NonExprNode<C>;
      return false;
    default:
      n satisfies Expression<C>;
      return true;
  }
}

export function isStatement<C extends S = Concrete>(
  n: Node<C>
): n is Statement<C> {
  switch (n.type) {
    case "ExprStatement":
    case "Table":
    case "Image":
    case "Text":
    case "Folder":
    case "Settings":
    case "Ticker":
      n satisfies Statement<C>;
      return true;
    default:
      n satisfies NonExprNonStatementNode<C> | Expression<C>;
      return false;
  }
}

export class NodePath<C extends S = Concrete, T extends Node<C> = Node<C>> {
  constructor(
    public node: T,
    public parentPath: NodePath<C> | null,
    public name?: string | number
  ) {}

  get parent() {
    return this.parentPath ? this.parentPath.node : null;
  }

  withChild<U extends Node<C>>(node: U, name: string | number): NodePath<C, U> {
    return new NodePath<C, U>(node, this, name);
  }
}
