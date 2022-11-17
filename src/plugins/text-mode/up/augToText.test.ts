import Aug from "../aug/AugState";
import {
  assignmentExpr,
  binop,
  comparator,
  functionCall,
  id,
  list,
  listAccess,
  negative,
  number,
  range,
  updateRule,
} from "../aug/augBuilders";
import { itemToText } from "./augToText";

jest.mock("utils/depUtils");
jest.mock("globals/window");

function testStmt(desc: string, item: Aug.ItemAug, expected: string) {
  test(desc, () => {
    const text = itemToText(item);
    expect(text.split(/\s*@{/)[0]).toEqual(expected);
  });
}

function testExprPlain(
  desc: string,
  expected: string,
  expr: Aug.Latex.AnyRootOrChild
) {
  testStmt(
    desc,
    {
      type: "expression",
      id: "1",
      latex: expr,
      color: "",
      hidden: false,
      errorHidden: false,
      pinned: false,
      secret: false,
      glesmos: false,
      fillOpacity: number(0),
      displayEvaluationAsFraction: false,
      slider: {},
      vizProps: {},
    },
    expected
  );
}

function testExpr(desc: string, expected: string, expr: Aug.Latex.AnyChild) {
  testExprPlain(desc, "y = " + expected, comparator("=", id("y"), expr));
}

describe("Basic exprs", () => {
  describe("Number", () => {
    testExpr("one digit", "1", number(1));
    testExpr("large", "123456", number(123456));
    testExpr(
      "scientific notation",
      "4.230000000000001e25",
      number(4.23 * 10 ** 25)
    );
    testExpr("between 0 and 1", "0.25", number(0.25));
    testExpr("large with decimal", "123.456", number(123.456));
    testExpr("negative", "-123", number(-123));
  });
  describe("Identifier", () => {
    testExpr("one character", "a", id("a"));
    testExpr("multiple characters", "abcd", id("a_bcd"));
  });
  describe("RepeatedExpression", () => {
    // TODO: don't need parens for any of these
    testExpr("sum", "(sum i=(1 ... 5) (i + 2))", {
      type: "RepeatedOperator",
      name: "Sum",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Add", id("i"), number(2)),
    });
    testExpr("product", "(product i=(1 ... 5) (i * 2))", {
      type: "RepeatedOperator",
      name: "Product",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Multiply", id("i"), number(2)),
    });
    testExpr("integral", "(integral x=(1 ... 5) (x * 2))", {
      type: "Integral",
      differential: id("x"),
      start: number(1),
      end: number(5),
      integrand: binop("Multiply", id("x"), number(2)),
    });
  });
  describe("ListExpression", () => {
    testExpr("empty", "[]", list());
    testExpr("one element", "[1]", list(number(1)));
    testExpr(
      "three elements",
      "[1, 2, x]",
      list(number(1), number(2), id("x"))
    );
    testExpr("simple range", "[1...10]", range([number(1)], [number(10)]));
    testExpr(
      "range with three start and end elements",
      "[1, 2, 3...10, 11, 12]",
      range(
        [number(1), number(2), number(3)],
        [number(10), number(11), number(12)]
      )
    );
  });
  describe("ListComprehension", () => {
    testExpr("single nest", "[i + 1 for i=L]", {
      type: "ListComprehension",
      expr: binop("Add", id("i"), number(1)),
      assignments: [assignmentExpr(id("i"), id("L"))],
    });
    testExpr("double nesting", "[i + j for i=L, j=[1...5]]", {
      type: "ListComprehension",
      expr: binop("Add", id("i"), id("j")),
      assignments: [
        assignmentExpr(id("i"), id("L")),
        assignmentExpr(id("j"), range([number(1)], [number(5)])),
      ],
    });
  });
  describe("Piecewise", () => {
    testExpr("empty piecewise", "{else: 1}", {
      type: "Piecewise",
      condition: true,
      consequent: number(1),
      alternate: number(NaN),
    });
    testExpr("no implicit consequent", "{x > 1: 1}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(1),
      alternate: number(NaN),
    });
    testExpr("single condition", "{x > 1: 2}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: number(NaN),
    });
    testExpr("two conditions and else", "{x > 1: 2, y > 3: 4, else: 5}", {
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
    testExpr("update rule", "a -> 7", {
      type: "UpdateRule",
      variable: id("a"),
      expression: number(7),
    });
  });
  describe("PrefixExpression", () => {
    testExpr("negative number", "-5", negative(number(5)));
    testExpr("negated identifier", "-x", negative(id("x")));
  });
  describe("PostfixExpression", () => {
    testExpr("factorial", "x!", functionCall(id("factorial"), [id("x")]));
    testExpr(
      "negative factorial",
      "-(x!)",
      negative(functionCall(id("factorial"), [id("x")]))
    );
  });
  describe("ParenthesizedExpression", () => {
    testExpr("point", "(2, 3)", {
      type: "Seq",
      parenWrapped: true,
      args: [number(2), number(3)],
    });
    testExpr("unwrapped action sequence", "a -> 2, b -> 3, c -> 4", {
      type: "Seq",
      parenWrapped: false,
      args: [
        updateRule(id("a"), number(2)),
        updateRule(id("b"), number(3)),
        updateRule(id("c"), number(4)),
      ],
    });
    testExpr("wrapped action sequence", "(a -> 2, b -> 3)", {
      type: "Seq",
      parenWrapped: true,
      args: [updateRule(id("a"), number(2)), updateRule(id("b"), number(3))],
    });
  });
  describe("UpdateRule", () => {
    testExpr("Sequence UpdateRule", "a -> b, b -> a", {
      type: "Seq",
      parenWrapped: false,
      args: [updateRule(id("a"), id("b")), updateRule(id("b"), id("a"))],
    });
    testExprPlain(
      "BinaryExpression UpdateRule",
      "A = a -> b",
      comparator("=", id("A"), updateRule(id("a"), id("b")))
    );
    testExpr("Piecewise UpdateRule", "{a = b: a -> 3, else: a -> b}", {
      type: "Piecewise",
      condition: comparator("=", id("a"), id("b")),
      consequent: updateRule(id("a"), number(3)),
      alternate: updateRule(id("a"), id("b")),
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
    testExpr("dot access call", "L.random(5)", {
      type: "DotAccess",
      object: id("L"),
      property: functionCall(id("random"), [number(5)]),
    });
  });
  describe("ListAccessExpression", () => {
    testExpr("numeric index", "L[1]", listAccess(id("L"), number(1)));
    testExpr(
      "filter",
      "L[L > 5]",
      listAccess(id("L"), comparator(">", id("L"), number(5)))
    );
    testExpr(
      "range",
      "L[1...5]",
      listAccess(id("L"), range([number(1)], [number(5)]))
    );
  });
  describe("BinaryExpression", () => {
    testExpr("addition", "2 + 3", binop("Add", number(2), number(3)));
    testExpr("subtraction", "2 - 3", binop("Subtract", number(2), number(3)));
    testExpr(
      "multiplication",
      "2 * 3",
      binop("Multiply", number(2), number(3))
    );
    testExpr(
      "scientific notation notation",
      "2e25",
      binop("Multiply", number(2), binop("Exponent", number(10), number(25)))
    );
    testExpr("division", "2 / 3", binop("Divide", number(2), number(3)));
    testExpr("exponents", "2 ^ 3", binop("Exponent", number(2), number(3)));
  });
  describe("PostfixExpression", () => {
    testExpr("factorial", "x!", functionCall(id("factorial"), [id("x")]));
  });
  describe("CallExpression", () => {
    testExpr("single arg", "f(x)", functionCall(id("f"), [id("x")]));
    testExpr("two args", "g(x, y)", functionCall(id("g"), [id("x"), id("y")]));
  });
  // TODO: don't need parens here
  testExpr("Derivative", "((d/d x) f(x))", {
    type: "Derivative",
    arg: functionCall(id("f"), [id("x")]),
    variable: id("x"),
  });
  testExpr("Prime", "f'''(x)", {
    type: "Prime",
    arg: functionCall(id("f"), [id("x")]),
    order: 3,
  });
});

describe("Parens", () => {
  testExpr(
    "Always parenthesize repeated expression",
    "1 + (sum i=(1 ... 5) (i + 2))",
    binop("Add", number(1), {
      type: "RepeatedOperator",
      name: "Sum",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Add", id("i"), number(2)),
    })
  );
  testExpr(
    "BinaryOperator[any]",
    "(L1 + L2)[a + b]",
    listAccess(binop("Add", id("L1"), id("L2")), binop("Add", id("a"), id("b")))
  );
  // TODO: don't need parens here
  testExpr("Derivative BinaryOperator", "((d/d x) (x + y))", {
    type: "Derivative",
    arg: binop("Add", id("x"), id("y")),
    variable: id("x"),
  });
  describe("Prefix Expression", () => {
    testExpr(
      "(-a) ^ b",
      "(-a) ^ b",
      binop("Exponent", negative(id("a")), id("b"))
    );
    testExpr("(-x)[any]", "(-a)[b]", listAccess(negative(id("a")), id("b")));
    testExpr("-(-x)", "-(-x)", negative(negative(id("x"))));
    testExpr("a -> -a", "a -> -a", updateRule(id("a"), negative(id("a"))));
  });
  describe("Binary Expressions", () => {
    testExpr(
      "(+)*",
      "(a + b) * c",
      binop("Multiply", binop("Add", id("a"), id("b")), id("c"))
    );
    testExpr(
      "(+)-",
      "a + b - c",
      binop("Subtract", binop("Add", id("a"), id("b")), id("c"))
    );
    testExpr(
      "-(+)",
      "a - (b + c)",
      binop("Subtract", id("a"), binop("Add", id("b"), id("c")))
    );
    testExpr(
      "(*)/",
      "(a * b) / c",
      binop("Divide", binop("Multiply", id("a"), id("b")), id("c"))
    );
    testExpr(
      "(/)*",
      "(a / b) * c",
      binop("Multiply", binop("Divide", id("a"), id("b")), id("c"))
    );
    testExpr(
      "(^)^",
      "(a ^ b) ^ c",
      binop("Exponent", binop("Exponent", id("a"), id("b")), id("c"))
    );
    testExpr(
      "^(^)",
      "a ^ (b ^ c)",
      binop("Exponent", id("a"), binop("Exponent", id("b"), id("c")))
    );
  });
});
