import Aug from "./AugState";

export function number(x: number): Aug.Latex.Constant {
  return {
    type: "Constant",
    value: x,
  };
}

export function id(name: string): Aug.Latex.Identifier {
  return {
    type: "Identifier",
    symbol: name,
  };
}

export function binop(
  op: "Add" | "Subtract" | "Multiply" | "Divide" | "Exponent",
  left: Aug.Latex.AnyChild,
  right: Aug.Latex.AnyChild
): Aug.Latex.BinaryOperator {
  return {
    type: "BinaryOperator",
    name: op,
    left,
    right,
  };
}

type CompOp = "<" | "<=" | "=" | ">=" | ">";

export function comparator(
  op: CompOp,
  left: Aug.Latex.AnyChild,
  right: Aug.Latex.AnyChild
): Aug.Latex.Comparator {
  return {
    type: "Comparator",
    operator: op,
    left,
    right,
  };
}

export function doubleInequality(
  left: Aug.Latex.AnyChild,
  leftOperator: CompOp,
  middle: Aug.Latex.AnyChild,
  rightOperator: CompOp,
  right: Aug.Latex.AnyChild
) {
  return {
    type: "DoubleInequality",
    left,
    leftOperator,
    middle,
    rightOperator,
    right,
  };
}

export function list(...children: Aug.Latex.AnyChild[]): Aug.Latex.List {
  return {
    type: "List",
    args: children,
  };
}

export function assignmentExpr(
  variable: Aug.Latex.Identifier,
  expression: Aug.Latex.AnyChild
): Aug.Latex.AssignmentExpression {
  return {
    type: "AssignmentExpression",
    variable,
    expression,
  };
}

export function substitution(
  body: Aug.Latex.AnyChild,
  ...assignments: Aug.Latex.AssignmentExpression[]
): Aug.Latex.Substitution {
  return { type: "Substitution", body, assignments };
}

export function updateRule(
  variable: Aug.Latex.Identifier,
  expression: Aug.Latex.AnyChild
): Aug.Latex.UpdateRule {
  return {
    type: "UpdateRule",
    variable,
    expression,
  };
}

export function functionCall(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[]
): Aug.Latex.FunctionCall {
  return {
    type: "FunctionCall",
    callee,
    args,
  };
}

export function negative(arg: Aug.Latex.AnyChild): Aug.Latex.Negative {
  return {
    type: "Negative",
    arg,
  };
}

export function factorial(arg: Aug.Latex.AnyChild): Aug.Latex.Factorial {
  return {
    type: "Factorial",
    arg,
  };
}

export function listAccess(
  list: Aug.Latex.AnyChild,
  index: Aug.Latex.AnyChild
): Aug.Latex.ListAccess {
  return {
    type: "ListAccess",
    list,
    index,
  };
}

export function range(
  start: Aug.Latex.AnyChild[],
  end: Aug.Latex.AnyChild[]
): Aug.Latex.Range {
  return {
    type: "Range",
    start,
    end,
  };
}

export function bareSeq(...args: Aug.Latex.AnyChild[]): Aug.Latex.Seq {
  return {
    type: "Seq",
    parenWrapped: false,
    args,
  };
}

export function wrappedSeq(...args: Aug.Latex.AnyChild[]): Aug.Latex.Seq {
  return {
    type: "Seq",
    parenWrapped: true,
    args,
  };
}
