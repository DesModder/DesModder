import textToAST from "./textToAST";
import astToAug from "./astToAug";
import * as Aug from "../aug/AugState";
import { test, expect, describe } from "@jest/globals";
import { mapFromEntries } from "../../../utils/utils";

function textToAug(s: string) {
  return astToAug(textToAST(s));
}

const colors = ["#c74440", "#2d70b3", "#388c46", "#6042a6", "#000000"];

const exprDefaults = {
  type: "expression",
  id: "1",
  latex: number(1),
  color: colors[0],
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

const columnDefaults = {
  type: "column",
  hidden: false,
  values: [],
  color: colors[0],
};

const tableDefaults = {
  type: "table",
  id: "1",
  pinned: false,
  secret: false,
};

const defaultSettings: Aug.GraphSettings = {
  viewport: {
    xmin: -10,
    ymin: -10,
    xmax: 10,
    ymax: 10,
  },
};

function getTestName(desc: string, s: string) {
  return `${desc} ${JSON.stringify(s).split(/ ?@/)[0]}`;
}

function testSettings(desc: string, s: string, expected: any) {
  test(getTestName(desc, s), () => {
    const graphSettings = textToAug(s).settings;
    expect(graphSettings).toEqual(expected);
  });
}

function testStmt(desc: string, s: string, expected: any) {
  test(getTestName(desc, s), () => {
    const augStmt = textToAug(s).expressions.list[0];
    expect(augStmt).toEqual(expected);
  });
}

function testExpr(desc: string, s: string, expected: any) {
  testStmt(desc, s, {
    ...exprDefaults,
    latex: expected,
  });
}

function testString(desc: string, s: string, expected: string) {
  testStmt(desc, `1 @{id:${s}}`, {
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
    // TODO: testExpr("dot access call", "L.random(5)", {});
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
    testStmt("Identifier color", `1 @{color:C}`, {
      ...exprDefaults,
      color: id("C"),
    });
    testStmt("String color", `1 @{color:"#abcdef"}`, {
      ...exprDefaults,
      color: "#abcdef",
    });
  });
  describe("Basic booleans", () => {
    testStmt("Hidden", `1 @{hidden: true}`, {
      ...exprDefaults,
      hidden: true,
    });
    testStmt("Secret", `1 @{secret:true}`, {
      ...exprDefaults,
      secret: true,
    });
    testStmt("Fraction", `1 @{displayEvaluationAsFraction:true}`, {
      ...exprDefaults,
      displayEvaluationAsFraction: true,
    });
    testStmt("Error hidden", `1 @{errorHidden:true}`, {
      ...exprDefaults,
      errorHidden: true,
    });
    testStmt("Glesmos", `1 @{glesmos:true}`, {
      ...exprDefaults,
      glesmos: true,
    });
    testStmt("Pinned", `1 @{pinned:true}`, {
      ...exprDefaults,
      pinned: true,
    });
  });
  describe("Label", () => {
    testStmt("Label text", `1 @{label:@{text:"hello"}}`, {
      ...exprDefaults,
      label: {
        text: "hello",
        size: number(1),
        orientation: "default",
        angle: number(0),
        outline: true,
        showOnHover: false,
        editableMode: "NONE",
      },
    });
    testStmt(
      "Full label info",
      `1 @{
        label:@{
          text: "abc",
          size: 2,
          orientation: "above",
          angle: pi,
          outline: false,
          showOnHover: true,
          editableMode: "TEXT",
        }
      }`,
      {
        ...exprDefaults,
        label: {
          text: "abc",
          size: number(2),
          orientation: "above",
          angle: id("pi"),
          outline: false,
          showOnHover: true,
          editableMode: "TEXT",
        },
      }
    );
  });
  describe("Lines", () => {
    testStmt("Lines", `1 @{lines:@{opacity: 1, width: 5, style: "DASHED"}}`, {
      ...exprDefaults,
      lines: {
        opacity: number(1),
        width: number(5),
        style: "DASHED",
      },
    });
    testStmt("Lines defaults", `1 @{lines:@{}}`, {
      ...exprDefaults,
      lines: {
        opacity: number(0.9),
        width: number(2.5),
        style: "SOLID",
      },
    });
  });
});

describe("Tables", () => {
  testStmt("Value list", `table { [1,2,3] }`, {
    ...tableDefaults,
    columns: [
      {
        ...columnDefaults,
        values: [number(1), number(2), number(3)],
        id: "2",
      },
    ],
  });
  testStmt("Expression", `table { L+1 }`, {
    ...tableDefaults,
    columns: [
      {
        ...columnDefaults,
        latex: binop("Add", id("L"), number(1)),
        id: "2",
      },
    ],
  });
  testStmt("Assignment", `table { a=[1,2,3] }`, {
    ...tableDefaults,
    columns: [
      {
        ...columnDefaults,
        latex: id("a"),
        values: [number(1), number(2), number(3)],
        hidden: false,
        id: "2",
      },
    ],
  });
});

describe("Regressions", () => {
  testStmt("Blank regression", `Y ~ a`, {
    ...exprDefaults,
    latex: {
      left: id("Y"),
      right: id("a"),
      type: "Regression",
    },
  });
  testStmt("Regression with values", `Y ~ a # r { a = 1.5 }`, {
    ...exprDefaults,
    latex: {
      left: id("Y"),
      right: id("a"),
      type: "Regression",
    },
    regression: {
      isLogMode: false,
      regressionParameters: mapFromEntries([
        [
          {
            symbol: "a",
            type: "Identifier",
          },
          1.5,
        ],
      ]),
      residualVariable: {
        symbol: "r",
        type: "Identifier",
      },
    },
  });
});

describe("Text", () => {
  testStmt("Text", `"abc"`, {
    type: "text",
    id: "1",
    pinned: false,
    secret: false,
    text: "abc",
  });
});

describe("Image", () => {
  testStmt("Plain image", `image "name" "data:image/png,stub"`, {
    type: "image",
    id: "1",
    pinned: false,
    secret: false,
    name: "name",
    image_url: "data:image/png,stub",
    width: number(10),
    height: number(10),
    center: {
      type: "Seq",
      parenWrapped: true,
      args: [number(0), number(0)],
    },
    angle: number(0),
    opacity: number(1),
    foreground: false,
    draggable: false,
  });
  testStmt(
    "Image with options",
    `image "name" "data:image/png,stub"
      @{
        secret: true,
        pinned: true,
        width: 20,
        height: 30,
        center: P,
        angle: pi,
        opacity: 0.5,
        foreground: true,
        draggable: true,
      }`,
    {
      type: "image",
      id: "1",
      pinned: true,
      secret: true,
      name: "name",
      image_url: "data:image/png,stub",
      width: number(20),
      height: number(30),
      center: id("P"),
      angle: id("pi"),
      opacity: number(0.5),
      foreground: true,
      draggable: true,
    }
  );
});

const folderDefaults = {
  type: "folder",
  id: "1",
  collapsed: false,
  hidden: false,
  pinned: false,
  secret: false,
};

describe("Folder", () => {
  testStmt(
    "Plain folder",
    `folder "Title" {
      1
    }`,
    {
      ...folderDefaults,
      title: "Title",
      children: [
        {
          ...exprDefaults,
          id: "2",
        },
      ],
    }
  );
  testStmt(
    "Folder options",
    `folder "Title" {}
      @{pinned:true,collapsed:true,secret:true,hidden:true}`,
    {
      type: "folder",
      id: "1",
      title: "Title",
      collapsed: true,
      hidden: true,
      pinned: true,
      secret: true,
      children: [],
    }
  );
});
describe("Automatic IDs", () => {
  test("IDs are correctly managed with tables", () => {
    const exprs = textToAug(`
      table {
        a=[]
        b=[]
      }
      1
    `).expressions.list;
    expect(exprs[0]).toEqual({
      ...tableDefaults,
      columns: [
        {
          ...columnDefaults,
          latex: id("a"),
          id: "2",
        },
        {
          ...columnDefaults,
          latex: id("b"),
          id: "3",
          color: colors[1],
        },
      ],
    });
    expect(exprs[1]).toEqual({
      ...exprDefaults,
      latex: number(1),
      id: "4",
      color: colors[2],
    });
  });
  test("IDs are correctly managed with folders", () => {
    const exprs = textToAug(`
      folder "Title" {
        a
        b
      }
      1
    `).expressions.list;
    expect(exprs[0]).toEqual({
      ...folderDefaults,
      title: "Title",
      children: [
        {
          ...exprDefaults,
          latex: id("a"),
          id: "2",
        },
        {
          ...exprDefaults,
          color: colors[1],
          latex: id("b"),
          id: "3",
        },
      ],
    });
    expect(exprs[1]).toEqual({
      ...exprDefaults,
      latex: number(1),
      color: colors[2],
      id: "4",
    });
  });
});

describe("Settings", () => {
  testSettings("No settings expr", `1`, defaultSettings);
  testSettings(
    "All settings",
    `settings @{
      randomSeed: "abc",
      viewport: @{
        xmin: -20,
        ymin: -5,
        xmax: 20,
        ymax: 5,
      },
      xAxisMinorSubdivisions: 0,
      yAxisMinorSubdivisions: 0,
      degreeMode: true,
      showGrid: false,
      showXAxis: false,
      showYAxis: false,
      xAxisNumbers: false,
      yAxisNumbers: false,
      polarNumbers: false,
      xAxisStep: 1,
      yAxisStep: 1,
      xAxisArrowMode: "BOTH",
      yAxisArrowMode: "BOTH",
      xAxisLabel: "x",
      yAxisLabel: "y",
      squareAxes: false,
      restrictGridToFirstQuadrant: true,
      polarMode: false
    }`,
    {
      randomSeed: "abc",
      viewport: {
        xmin: -20,
        ymin: -5,
        xmax: 20,
        ymax: 5,
      },
      xAxisMinorSubdivisions: 0,
      yAxisMinorSubdivisions: 0,
      degreeMode: true,
      showGrid: false,
      showXAxis: false,
      showYAxis: false,
      xAxisNumbers: false,
      yAxisNumbers: false,
      polarNumbers: false,
      xAxisStep: 1,
      yAxisStep: 1,
      xAxisArrowMode: "BOTH",
      yAxisArrowMode: "BOTH",
      xAxisLabel: "x",
      yAxisLabel: "y",
      squareAxes: false,
      restrictGridToFirstQuadrant: true,
      polarMode: false,
    }
  );
});

// TODO: test constexpr evaluation
// TODO: operator precedence
