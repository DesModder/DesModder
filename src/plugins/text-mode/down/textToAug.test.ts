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
  updateRule,
} from "../aug/augBuilders";
import parser from "../lezer/syntax.grammar";
import astToAug from "./astToAug";
import { cstToAST } from "./cstToAST";
import { error, warning } from "./diagnostics";
import { Diagnostic } from "@codemirror/lint";
import { Text } from "@codemirror/state";
import { test, expect, describe } from "@jest/globals";

jest.mock("utils/depUtils");
jest.mock("globals/window");

function textToAug(text: string) {
  const cst = parser.parse(text);
  const [diagnostics, program] = cstToAST(cst, Text.of(text.split("\n")));
  return astToAug(diagnostics, program);
}

const colors = ["#c74440", "#2d70b3", "#388c46", "#6042a6", "#000000"];

const exprDefaults = {
  type: "expression",
  id: "__dsm-auto-1",
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
  id: "__dsm-auto-2",
  hidden: false,
  values: [],
  color: colors[0],
};

const tableDefaults = {
  type: "table",
  id: "__dsm-auto-1",
  pinned: false,
  secret: false,
};

const folderDefaults = {
  type: "folder",
  id: "__dsm-auto-1",
  collapsed: false,
  hidden: false,
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
    const [{ diagnostics }, res] = textToAug(s);
    expect(diagnostics).toEqual([]);
    expect(res).not.toBeNull();
    if (res === null) return;
    const graphSettings = res.settings;
    expect(graphSettings).toEqual(expected);
  });
}

function testStmt(desc: string, s: string, ...expected: any[]) {
  test(getTestName(desc, s), () => {
    const [{ diagnostics }, res] = textToAug(s);
    expect(diagnostics).toEqual([]);
    expect(res).not.toBeNull();
    if (res === null) return;
    expected.forEach((e, i) => {
      const augStmt = res.expressions.list[i];
      expect(augStmt).toEqual(e);
    });
  });
}

function pos(from: number, to: number) {
  return { from, to };
}

function testDiagnostics(desc: string, s: string, expected: Diagnostic[]) {
  test(getTestName(desc, s), () => {
    const [{ diagnostics }] = textToAug(s);
    expect(diagnostics).toEqual(expected);
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
    testExpr("multiple characters", "abcd", id("a_bcd"));
  });
  describe("String", () => {
    testString("simple", `"abc"`, "abc");
    testString("escaped quote", `"abc\\"def"`, 'abc"def');
  });
  describe("RepeatedExpression", () => {
    testExpr("sum", "sum i=(1...5) (i+2)", {
      type: "RepeatedOperator",
      name: "Sum",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Add", id("i"), number(2)),
    });
    testExpr("product", "product i=(1...5) (i*2)", {
      type: "RepeatedOperator",
      name: "Product",
      index: id("i"),
      start: number(1),
      end: number(5),
      expression: binop("Multiply", id("i"), number(2)),
    });
    testExpr("integral", "integral x=(1...5) (x*2)", {
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
    testExpr("three elements", "[1,2,x]", list(number(1), number(2), id("x")));
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
    testExpr("trivial (else-only) piecewise", "{else:1}", {
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
    testExpr("single condition and implicit else", "{x>1:2,5}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: number(5),
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
    testExpr("negative number", "-5.0", negative(number(5)));
    testExpr("negated identifier", "-x", negative(id("x")));
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
  describe("Derivatives", () => {
    testExpr("Derivative", "(d/d x) f(x)", {
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
});

describe("Statement metadata", () => {
  describe("Color", () => {
    testStmt("Identifier color", `1 @{color:C}`, {
      ...exprDefaults,
      color: id("C"),
    });
    testStmt("Identifier color from color set", `1 @{color:BLUE}`, {
      ...exprDefaults,
      color: "#2d70b3",
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
  describe("Sliders", () => {
    testStmt("Slider defaults", `1 @{slider:@{}}`, {
      ...exprDefaults,
      slider: {
        period: 4000,
        loopMode: "LOOP_FORWARD_REVERSE",
        playDirection: 1,
        isPlaying: false,
        min: number(-10),
        max: number(10),
        step: number(0),
      },
    });
    testStmt(
      "Slider custom values",
      `1 @{
      slider: @{
        period: 2000,
        loopMode: "LOOP_FORWARD",
        reversed: true,
        playing: true,
        min: 0,
        max: 20,
        step: 1
      }
    }`,
      {
        ...exprDefaults,
        slider: {
          period: 2000,
          loopMode: "LOOP_FORWARD",
          playDirection: -1,
          isPlaying: true,
          min: number(0),
          max: number(20),
          step: number(1),
        },
      }
    );
  });
  describe("Fill", () => {
    testStmt("Zero fill", `1 @{fill: 0}`, exprDefaults);
    testStmt("Nonzero fill", `1 @{fill: 0.5}`, {
      ...exprDefaults,
      fillOpacity: number(0.5),
    });
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
  describe("Points", () => {
    testStmt(
      "Points",
      `1 @{points:@{opacity: 1, size: 15, style: "CROSS", drag: "AUTO"}}`,
      {
        ...exprDefaults,
        points: {
          opacity: number(1),
          size: number(15),
          style: "CROSS",
          dragMode: "AUTO",
        },
      }
    );
    testStmt("Points defaults", `1 @{points:@{}}`, {
      ...exprDefaults,
      points: {
        opacity: number(0.9),
        size: number(9),
        style: "POINT",
        dragMode: "NONE",
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
        values: [],
        latex: {
          type: "BinaryOperator",
          name: "Add",
          left: number(0),
          right: list(number(1), number(2), number(3)),
        },
      },
    ],
  });
  testStmt("Expression", `table { L+1 }`, {
    ...tableDefaults,
    columns: [
      {
        ...columnDefaults,
        latex: binop("Add", id("L"), number(1)),
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
      },
    ],
  });
});

describe("Comments", () => {
  testStmt("Line comments", `// prev line\n1 // end line\n// next line`, {
    ...exprDefaults,
    latex: number(1),
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
    regression: {
      isLogMode: false,
      regressionParameters: new Map(),
    },
  });
  testStmt("Regression with values", `r = Y ~ a #{ a = 1.5 }`, {
    ...exprDefaults,
    latex: {
      left: id("Y"),
      right: id("a"),
      type: "Regression",
    },
    regression: {
      isLogMode: false,
      regressionParameters: new Map([
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
    id: "__dsm-auto-1",
    pinned: false,
    secret: false,
    text: "abc",
  });
});

describe("Semicolons", () => {
  testStmt("No insertion inside unclosed expressions", `1 + \nx`, {
    ...exprDefaults,
    latex: binop("Add", number(1), id("x")),
  });
  testStmt(
    "Simple semi insertion",
    `y=x\nx=1`,
    {
      ...exprDefaults,
      latex: comparator("=", id("y"), id("x")),
    },
    {
      ...exprDefaults,
      id: "__dsm-auto-2",
      color: "#2d70b3",
      latex: comparator("=", id("x"), number(1)),
    }
  );
  testStmt("Insertion inside folder", `folder "" {\ny=x\nx=1}`, {
    ...folderDefaults,
    title: "",
    children: [
      {
        ...exprDefaults,
        id: "__dsm-auto-2",
        color: "#c74440",
        latex: comparator("=", id("y"), id("x")),
      },
      {
        ...exprDefaults,
        id: "__dsm-auto-3",
        color: "#2d70b3",
        latex: comparator("=", id("x"), number(1)),
      },
    ],
  });
  testStmt("Insertion inside no-newline folder", `folder "" {y=x;x=1}`, {
    ...folderDefaults,
    title: "",
    children: [
      {
        ...exprDefaults,
        id: "__dsm-auto-2",
        latex: comparator("=", id("y"), id("x")),
      },
      {
        ...exprDefaults,
        id: "__dsm-auto-3",
        color: "#2d70b3",
        latex: comparator("=", id("x"), number(1)),
      },
    ],
  });
  testStmt(
    "Force semicolon to avoid multi-line CallExpression",
    `y=x\n(x)^2`,
    {
      ...exprDefaults,
      latex: comparator("=", id("y"), id("x")),
    },
    {
      ...exprDefaults,
      id: "__dsm-auto-2",
      color: "#2d70b3",
      latex: binop("Exponent", id("x"), number(2)),
    }
  );
  testStmt(
    "Force semicolon to avoid multi-line ListExpression",
    `[x,2,3]\n[1,2]+x`,
    {
      ...exprDefaults,
      latex: list(id("x"), number(2), number(3)),
    },
    {
      ...exprDefaults,
      id: "__dsm-auto-2",
      color: "#2d70b3",
      latex: binop("Add", list(number(1), number(2)), id("x")),
    }
  );
  testStmt(
    "Force semicolon to avoid multi-line subtraction",
    `x\n-x`,
    {
      ...exprDefaults,
      latex: id("x"),
    },
    {
      ...exprDefaults,
      id: "__dsm-auto-2",
      color: "#2d70b3",
      latex: negative(id("x")),
    }
  );
});
describe("Image", () => {
  testStmt("Plain image", `image "name" @{ url: "data:image/png,stub" }`, {
    type: "image",
    id: "__dsm-auto-1",
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
    `image "name"
      @{
        url: "data:image/png,stub",
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
      id: "__dsm-auto-1",
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
          id: "__dsm-auto-2",
        },
      ],
    }
  );
  testStmt(
    "Folder options",
    `folder "Title" {}
      @{collapsed:true,secret:true,hidden:true}`,
    {
      type: "folder",
      id: "__dsm-auto-1",
      title: "Title",
      collapsed: true,
      hidden: true,
      secret: true,
      children: [],
    }
  );
});
describe("Automatic IDs", () => {
  test("IDs are correctly managed with tables", () => {
    const [_analysis, res] = textToAug(`
      table {
        a=[]
        b=[]
      }
      1
    `);
    expect(res).not.toBeNull();
    if (res === null) return;
    const exprs = res.expressions.list;
    expect(exprs[0]).toEqual({
      ...tableDefaults,
      columns: [
        {
          ...columnDefaults,
          latex: id("a"),
        },
        {
          ...columnDefaults,
          latex: id("b"),
          id: "__dsm-auto-3",
          color: colors[1],
        },
      ],
    });
    expect(exprs[1]).toEqual({
      ...exprDefaults,
      latex: number(1),
      id: "__dsm-auto-4",
      color: colors[2],
    });
  });
  test("IDs are correctly managed with folders", () => {
    const [_errors, res] = textToAug(`
      folder "Title" {
        a
        b
      }
      1
    `);
    expect(res).not.toBeNull();
    if (res === null) return;
    const exprs = res.expressions.list;
    expect(exprs[0]).toEqual({
      ...folderDefaults,
      title: "Title",
      children: [
        {
          ...exprDefaults,
          latex: id("a"),
          id: "__dsm-auto-2",
        },
        {
          ...exprDefaults,
          color: colors[1],
          latex: id("b"),
          id: "__dsm-auto-3",
        },
      ],
    });
    expect(exprs[1]).toEqual({
      ...exprDefaults,
      latex: number(1),
      color: colors[2],
      id: "__dsm-auto-4",
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
      polarMode: false,
      lockViewport: true
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
      userLockedViewport: true,
    }
  );
});

describe("Diagnostics", () => {
  describe("Hydration diagnostics", () => {
    testDiagnostics(
      "Warning of missing properties",
      `settings
      @{abc: 1, viewport: @{def: 2}}`,
      [
        warning("Property abc unexpected on settings", pos(17, 20)),
        warning("Property def unexpected on settings.viewport", pos(37, 40)),
      ]
    );
    testDiagnostics(
      "Expected style mapping, got primitive",
      `y=x @{points: 7}`,
      [
        error(
          "Expected expression.points to be style mapping, but got primitive",
          pos(14, 15)
        ),
      ]
    );
    testDiagnostics(
      "Expected primitive, got style mapping",
      `y=1 @{color: "#FFF"}\ny=2 @{color: @{}}`,
      [
        error(
          "Expected expression.color to be primitive, but got style mapping",
          pos(34, 37)
        ),
      ]
    );
    testDiagnostics(
      "Unexpected enum value",
      `y=1 @{points: @{style: "ABC", drag: "DEF"}}`,
      [
        error(
          'Expected expression.points.style to be one of ["POINT","OPEN","CROSS"], but got "ABC" instead',
          pos(23, 28)
        ),
        error(
          'Expected expression.points.drag to be one of ["NONE","X","Y","XY","AUTO"], but got "DEF" instead',
          pos(36, 41)
        ),
      ]
    );
    // TODO: variable scoping, so `true` resolves to boolean
    testDiagnostics(
      "Expected color, got other",
      `y=1 @{color: "abc"}\ny=2 @{color: BLUE}\ny=3 @{color: 5}\ny=4 @{color: true}`,
      [
        error(
          "Expected expression.color to evaluate to string or identifier, but got number",
          pos(52, 53)
        ),
      ]
    );
    testDiagnostics(
      "Expected string,boolean,number got other",
      `settings @{randomSeed: 1, squareAxes: "abc", xAxisStep: true}`,
      [
        error(
          "Expected settings.squareAxes to evaluate to boolean, but got string",
          pos(38, 43)
        ),
        error(
          "Expected settings.randomSeed to evaluate to string, but got number",
          pos(23, 24)
        ),
        error(
          "Expected settings.xAxisStep to evaluate to number, but got boolean",
          pos(56, 60)
        ),
      ]
    );
  });
  describe("Evaluation diagnostics", () => {
    testDiagnostics(
      "Undefined identifier",
      `settings @{squareAxes: TRUE, xAxisStep: -b}`,
      [
        error("Undefined identifier: TRUE", pos(23, 27)),
        error("Undefined identifier: b", pos(41, 42)),
      ]
    );
  });
  describe("General diagnostics", () => {
    testDiagnostics("Regression value type error", `a ~ 3 #{ a = true }`, [
      error(
        "Expected regression parameter to evaluate to number, but got boolean",
        pos(13, 17)
      ),
    ]);
    testDiagnostics(
      "Table column assign to non-identifier",
      `table { f(x) = [1,2] }`,
      [
        error(
          "Expected column to assign to an identifier, but got CallExpression",
          pos(8, 12)
        ),
      ]
    );
    testDiagnostics("Table column non-list", `table { x1 = [1,2]; y1 = 42 }`, [
      error(
        "Expected table assignment to assign from a ListExpression, but got Number",
        pos(25, 27)
      ),
    ]);
    testDiagnostics("Settings in folder", `folder "title" { settings @{} }`, [
      error("Settings may not be in a folder", pos(17, 29)),
    ]);
    testDiagnostics("Invalid id", `y=x @{id: "__dsm-auto-1"}`, [
      error("ID may not start with '__'", pos(10, 24)),
    ]);
  });
  describe("Parse errors", () => {
    testDiagnostics("Empty program", `\n\n`, [
      warning("Program is empty. Try typing: y=x", undefined),
    ]);
    testDiagnostics("Binary op without indication of continuation", `1\n+ x`, [
      error("Syntax error; unexpected text: +", pos(2, 3)),
    ]);
    testDiagnostics("Skip node", `y=x @{} @#!# y=x^2`, [
      error("Syntax error; unexpected text: @#!#", pos(8, 12)),
    ]);
    testDiagnostics("Multiple skips", `y=)x]`, [
      error("Syntax error; unexpected text: )", pos(2, 3)),
      error("Syntax error; unexpected text: ]", pos(4, 5)),
    ]);
    testDiagnostics("Multiple insertions", `y=(1+)*(5+)`, [
      error("Syntax error; expected something here", pos(5, 5)),
      error("Syntax error; expected something here", pos(10, 10)),
    ]);
    testDiagnostics("Non-identifier callee", `y = 7(x)`, [
      error(
        "Invalid callee; expected identifier or member expression",
        pos(4, 5)
      ),
    ]);
    testDiagnostics("Non-simple statement in table", `table { "note" }`, [
      error("Expected a valid table column. Try: x1 = [1, 2, 3]", pos(8, 14)),
    ]);
    testDiagnostics("Invalid regression body", `a ~ 5 #{ "note" }`, [
      error("Invalid regression body", pos(9, 15)),
    ]);
    testDiagnostics("Non-identifier residual variable", `f(x) = a ~ b`, [
      error(
        "Residual variable must be identifier, but got CallExpression",
        pos(0, 4)
      ),
    ]);
    testDiagnostics("Non-identifier update assignment", `f(x) -> 5`, [
      error(
        "Left side of update rule must be Identifier, but got CallExpression",
        pos(0, 4)
      ),
    ]);
  });
});

// TODO: test constexpr evaluation

describe("Operator precedence", () => {
  testExpr(
    "member > access",
    "P.x[5]",
    listAccess(
      {
        type: "OrderedPairAccess",
        point: id("P"),
        index: "x",
      },
      number(5)
    )
  );
  testExpr(
    "postfix > exp",
    "x^y!",
    binop("Exponent", id("x"), functionCall(id("factorial"), [id("y")]))
  );
  testExpr(
    "exp > prefix",
    "-x^y",
    negative(binop("Exponent", id("x"), id("y")))
  );
  testExpr(
    "prefix > times",
    "-x*y",
    binop("Multiply", negative(id("x")), id("y"))
  );
  testExpr(
    "times > plus",
    "x+y*z",
    binop("Add", id("x"), binop("Multiply", id("y"), id("z")))
  );
  // TODO: some of the more arcane ones: derivative, and lower
});
