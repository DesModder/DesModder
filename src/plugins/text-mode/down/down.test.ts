import textToAST from "./textToAST";
import astToAug from "./astToAug";
import * as Aug from "../aug/AugState";
import { test, expect, describe } from "@jest/globals";

function textToAug(s: string) {
  return astToAug(textToAST(s));
}

const exprDefaults = {
  type: "expression",
  id: "1",
  latex: number(1),
  color: "#FFF",
  hidden: false,
  errorHidden: false,
  glesmos: false,
  pinned: false,
  secret: false,
  fillOpacity: number(0),
  displayEvaluationAsFraction: false,
  slider: {},
  vizProps: {},
};

function testStmt(desc: string, s: string, expected: any) {
  test(`${desc} ${JSON.stringify(s)}`, () => {
    const augStmt = textToAug(s).expressions.list[0];
    expect(augStmt.type).toEqual("expression");
    if (augStmt.type === "expression") {
      expect(augStmt).toEqual(expected);
    }
  });
}

function testExpr(desc: string, s: string, expected: any) {
  testStmt(desc, `show ${s} @{id:"1",color:"#FFF"}`, {
    ...exprDefaults,
    latex: expected,
  });
}

function testString(desc: string, s: string, expected: string) {
  testStmt(desc, `show 1 @{id:${s},color:"#FFF"}`, {
    ...exprDefaults,
    id: expected,
  });
}

function number(x: number): Aug.Latex.Constant {
  return {
    type: "Constant",
    value: x,
  };
}

function id(name: string): Aug.Latex.Identifier {
  return {
    type: "Identifier",
    symbol: name,
  };
}

function binop(
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

function comparator(
  op: "<" | "<=" | "=" | ">=" | ">",
  left: Aug.Latex.AnyChild,
  right: Aug.Latex.AnyChild
) {
  return {
    type: "Comparator",
    operator: op,
    left,
    right,
  };
}

function assignmentExpr(
  variable: Aug.Latex.Identifier,
  expression: Aug.Latex.AnyChild
) {
  return {
    type: "AssignmentExpression",
    variable,
    expression,
  };
}

function updateRule(
  variable: Aug.Latex.Identifier,
  expression: Aug.Latex.AnyChild
) {
  return {
    type: "UpdateRule",
    variable,
    expression,
  };
}

function functionCall(
  callee: Aug.Latex.Identifier,
  args: Aug.Latex.AnyChild[]
) {
  return {
    type: "FunctionCall",
    callee,
    args,
  };
}

describe("Basic exprs", () => {
  // Grouped by grammar node type
  describe("Number", () => {
    testExpr("one digit", "1", number(1));
    testExpr("large", "123456", number(123456));
    testExpr("less than 1 without 0", ".25", number(0.25));
    testExpr("large with decimal", "123.456", number(123.456));
  });
  describe("Identifier", () => {
    testExpr("one character", "a", id("a"));
    testExpr("multiple characters", "abcd", id("abcd"));
  });
  describe("String", () => {
    testString("simple", `"abc"`, "abc");
    testString("escaped quote", `"abc\\"def"`, 'abc"def');
  });
  describe("RepeatedExpression", () => {
    testExpr("sum", "sum i=(1...5) i+2", {
      type: "RepeatedOperator",
      name: "Sum",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Add", id("i"), number(2)),
    });
    testExpr("product", "product i=(1...5) i*2", {
      type: "RepeatedOperator",
      name: "Product",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Multiply", id("i"), number(2)),
    });
  });
  describe("ListExpression", () => {
    testExpr("empty", "[]", {
      type: "List",
      args: [],
    });
    testExpr("one element", "[1]", {
      type: "List",
      args: [number(1)],
    });
    testExpr("three elements", "[1,2,x]", {
      type: "List",
      args: [number(1), number(2), id("x")],
    });
    testExpr("simple range", "[1...10]", {
      type: "Range",
      start: [number(1)],
      end: [number(10)],
    });
    testExpr(
      "range with three start and end elements",
      "[1,2,3,...,10,11,12]",
      {
        type: "Range",
        start: [number(1), number(2), number(3)],
        end: [number(10), number(11), number(12)],
      }
    );
  });
  describe("ListComprehension", () => {
    testExpr("single nest", "[i+1 for i=L]", {
      type: "ListComprehension",
      expr: binop("Add", id("i"), number(1)),
      assignments: [assignmentExpr(id("i"), id("L"))],
    });
    testExpr("double nesting", "[i+j for i=L,j=[1...5]]", {
      type: "ListComprehension",
      expr: binop("Add", id("i"), id("j")),
      assignments: [
        assignmentExpr(id("i"), id("L")),
        assignmentExpr(id("j"), {
          type: "Range",
          start: [number(1)],
          end: [number(5)],
        }),
      ],
    });
  });
  describe("Piecewise", () => {
    testExpr("empty piecewise", "{else:1}", {
      type: "Piecewise",
      condition: true,
      consequent: number(1),
      alternate: number(NaN),
    });
    testExpr("implicit consequent", "{x>1}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(1),
      alternate: number(NaN),
    });
    testExpr("single condition", "{x>1:2}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: number(NaN),
    });
    testExpr("two conditions and else", "{x>1:2,y>3:4,else:5}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: {
        type: "Piecewise",
        condition: comparator(">", id("y"), number(3)),
        consequent: number(4),
        alternate: number(5),
      },
    });
  });
  describe("Action", () => {
    testExpr("update rule", "a->7", {
      type: "UpdateRule",
      variable: id("a"),
      expression: number(7),
    });
  });
  describe("PrefixExpression", () => {
    testExpr("negative number", "-5.0", {
      type: "Negative",
      arg: number(5),
    });
    testExpr("negated identifier", "-x", {
      type: "Negative",
      arg: id("x"),
    });
  });
  describe("ParenthesizedExpression", () => {
    testExpr("parenthesized number", "(5)", number(5));
    testExpr("point", "(2,3)", {
      type: "Seq",
      parenWrapped: true,
      args: [number(2), number(3)],
    });
    testExpr("unwrapped action sequence", "a->2,b->3,c->4", {
      type: "Seq",
      parenWrapped: false,
      args: [
        updateRule(id("a"), number(2)),
        updateRule(id("b"), number(3)),
        updateRule(id("c"), number(4)),
      ],
    });
    testExpr("wrapped action sequence", "(a->2,b->3)", {
      type: "Seq",
      parenWrapped: true,
      args: [updateRule(id("a"), number(2)), updateRule(id("b"), number(3))],
    });
    testExpr("point", "(2,3)", {
      type: "Seq",
      parenWrapped: true,
      args: [number(2), number(3)],
    });
  });
  describe("MemberExpression", () => {
    testExpr("point access", "P.y", {
      type: "OrderedPairAccess",
      point: id("P"),
      index: "y",
    });
    testExpr("dot access", "L.random", {
      type: "DotAccess",
      object: id("L"),
      property: id("random"),
    });
  });
  describe("ListAccessExpression", () => {
    testExpr("numeric index", "L[1]", {
      type: "ListAccess",
      list: id("L"),
      index: number(1),
    });
    testExpr("filter", "L[L>5]", {
      type: "ListAccess",
      list: id("L"),
      index: comparator(">", id("L"), number(5)),
    });
    testExpr("range", "L[1...5]", {
      type: "ListAccess",
      list: id("L"),
      index: {
        type: "Range",
        start: [number(1)],
        end: [number(5)],
      },
    });
  });
  describe("BinaryExpression", () => {
    testExpr("addition", "2+3", binop("Add", number(2), number(3)));
    testExpr("subtraction", "2-3", binop("Subtract", number(2), number(3)));
    testExpr("multiplication", "2*3", binop("Multiply", number(2), number(3)));
    testExpr("division", "2/3", binop("Divide", number(2), number(3)));
    testExpr("exponents", "2^3", binop("Exponent", number(2), number(3)));
  });
  describe("PostfixExpression", () => {
    testExpr("factorial", "x!", functionCall(id("factorial"), [id("x")]));
  });
  describe("CallExpression", () => {
    testExpr("single arg", "f(x)", functionCall(id("f"), [id("x")]));
    testExpr("two args", "g(x,y)", functionCall(id("g"), [id("x"), id("y")]));
  });
});

describe("Statement metadata", () => {
  describe("Color", () => {
    testStmt("Identifier color", `show 1 @{id:"1",color:C}`, {
      ...exprDefaults,
      color: id("C"),
    });
    testStmt("String color", `show 1 @{id:"1",color:"#abcdef"}`, {
      ...exprDefaults,
      color: "#abcdef",
    });
  });
  // TODO
  // describe("GLesmos flags", () => {
  //   testStmt("");
  // });
});

// TODO: test constexpr evaluation
// TODO: operator precedence
// TODO: statement types
