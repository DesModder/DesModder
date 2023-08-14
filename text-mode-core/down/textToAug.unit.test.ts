import TextAST from "../TextAST";
import { buildConfig } from "../TextModeConfig";
import Aug from "../aug/AugState";
import {
  assignmentExpr,
  bareSeq,
  binop,
  comparator,
  doubleInequality,
  factorial,
  functionCall,
  id,
  list,
  listAccess,
  negative,
  number,
  substitution,
  updateRule,
  wrappedSeq,
} from "../aug/augBuilders";
import astToAug from "./astToAug";
import { error, warning } from "./diagnostics";
import { IncrementalState, parse } from "./textToAST";
import type { Diagnostic } from "@codemirror/lint";
// eslint-disable-next-line rulesdir/no-external-imports
import { test, expect as _expect, describe } from "@jest/globals";

const cfg = buildConfig({});

function textToAug(text: string, incr?: Partial<IncrementalState>) {
  const analysis = parse(cfg, text, incr);
  testPosNesting(analysis.program);
  return astToAug(cfg, analysis);
}

_expect.extend({
  ok(received, message) {
    return {
      pass: !!received,
      message: () => message,
    };
  },
});

declare module "expect" {
  interface Matchers<R> {
    ok: (message: string) => R;
  }
}

const expect = _expect as typeof _expect & (() => { ok: (s: string) => void });

function testPosNesting(node: TextAST.Node, okNoPos = false) {
  if (node?.type === undefined) return;
  const childPos = Object.values(node)
    .map((x) => x?.pos as TextAST.Pos)
    .filter((x) => x);
  if (!okNoPos) expect(node.pos).ok(`Type ${node.type} should have a pos`);
  if (node.pos) {
    expect(childPos.every((x) => x.from >= node.pos.from)).ok(
      `Type ${node.type} .pos.from should not exceed child.pos.from`
    );
    expect(childPos.every((x) => x.to <= node.pos.to)).ok(
      `Type ${node.type} .pos.to should not be less than child.pos.to`
    );
  }
  Object.values(node)
    .flat(1)
    .forEach((x) => testPosNesting(x, node.type === "PiecewiseBranch"));
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
  fillOpacity: undefined,
  displayEvaluationAsFraction: false,
  slider: {},
  vizProps: {},
} as const;

const columnDefaults = {
  type: "column",
  id: "2",
  hidden: false,
  values: [],
  color: colors[0],
} as const;

const tableDefaults = {
  type: "table",
  id: "1",
  pinned: false,
  secret: false,
} as const;

const folderDefaults = {
  type: "folder",
  id: "1",
  collapsed: false,
  hidden: false,
  secret: false,
} as const;

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

type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

function testStmt(
  desc: string,
  s: string,
  ...expected: DeepReadonly<Aug.ItemAug | Aug.TickerAug>[]
) {
  test(getTestName(desc, s), () => {
    const [{ diagnostics }, res] = textToAug(s);
    expect(diagnostics).toEqual([]);
    expect(res).not.toBeNull();
    if (res === null) return;
    expected.forEach((e, i) => {
      if ("handlerLatex" in e) {
        expect(res.expressions.ticker).toEqual(e);
      } else {
        const augStmt = res.expressions.list[i];
        expect(augStmt).toEqual(e);
      }
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
  testStmt(desc, `1@{onClick:A,clickDescription:${s}}`, {
    ...exprDefaults,
    clickableInfo: {
      description: expected,
      latex: id("A"),
    },
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
    testExpr("multiple characters with subscript", "a_bcd", id("a_bcd"));
    testExpr("backslash command broken by subscript", "t_heta", id("t_heta"));
    testExpr("backslash command", "theta", id("theta"));
    testExpr("backslash command with subscript", "theta_xy", id("theta_xy"));
    testExpr("operatorname", "min", id("min"));
    testExpr("operatorname with subscript", "min_xy", id("min_xy"));
    testExpr("fragile", "hypot", id("hypot"));
    testExpr("dt", "dt", id("dt"));
    testExpr("index", "index", id("index"));
    testDiagnostics("digits before sub", "a0_xy", [
      error("Digits are not allowed before '_'", pos(0, 5)),
    ]);
    testDiagnostics("trailing sub", "theta_", [
      error("Cannot end with '_'", pos(0, 6)),
    ]);
    testDiagnostics("multiple sub", "theta_x_y", [
      error("Too many '_' in identifier", pos(0, 9)),
    ]);
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
  describe("Substitution", () => {
    testExpr(
      "simple sub",
      "a with a=3",
      substitution(id("a"), assignmentExpr(id("a"), number(3)))
    );
    testExpr(
      "multiple subs",
      "a with a=3, b=3",
      substitution(
        id("a"),
        assignmentExpr(id("a"), number(3)),
        assignmentExpr(id("b"), number(3))
      )
    );
    testExpr(
      "sub precedence with arrow",
      "a->b, c->b with b=3",
      bareSeq(
        updateRule(id("a"), id("b")),
        updateRule(
          id("c"),
          substitution(id("b"), assignmentExpr(id("b"), number(3)))
        )
      )
    );
    testDiagnostics("substitution precedence with comma", "[b with b=3, 5]", [
      error("List comprehension must set variable = identifier", pos(13, 14)),
    ]);
  });
  describe("Piecewise", () => {
    testExpr("trivial piecewise", "{}", {
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
    testExpr("implicit consequent double inequality", "{1<x<5}", {
      type: "Piecewise",
      condition: doubleInequality(number(1), "<", id("x"), "<", number(5)),
      consequent: number(1),
      alternate: number(NaN),
    });
    testExpr("single condition", "{x>1:2}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: number(NaN),
    });
    testExpr("implicit consequent and implicit else", "{x>1,5}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(1),
      alternate: number(5),
    });
    testExpr("single condition and implicit else", "{x>1:2,5}", {
      type: "Piecewise",
      condition: comparator(">", id("x"), number(1)),
      consequent: number(2),
      alternate: number(5),
    });
    testExpr("implicit consequent twice", "{x<1,x>1}", {
      type: "Piecewise",
      condition: comparator("<", id("x"), number(1)),
      consequent: number(1),
      alternate: {
        type: "Piecewise",
        condition: comparator(">", id("x"), number(1)),
        consequent: number(1),
        alternate: number(NaN),
      },
    });
    testExpr("two conditions and else", "{x>1:2,y>3:4,5}", {
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
  describe("Piecewise Diagnostics", () => {
    testDiagnostics("not a condition: bad binop", "{x+3}", [
      error("Condition must be a comparison", pos(1, 4)),
    ]);
    testDiagnostics("not a condition: bad id", "{abc}", [
      error("Condition must be a comparison", pos(1, 4)),
    ]);
    testDiagnostics("not a condition on left of ':'", "{x+3:2}", [
      error("Condition must be a comparison", pos(1, 4)),
    ]);
    testDiagnostics("not a condition in implicit pos", "{abc,2}", [
      error("Condition must be a comparison", pos(1, 4)),
    ]);
    testDiagnostics("not comma", "{abc 2}", [
      error("Unexpected character in Piecewise", pos(5, 6)),
    ]);
  });
  describe("Action", () => {
    const rule = {
      type: "UpdateRule",
      variable: id("a"),
      expression: number(7),
    } as const;
    testExpr("update rule", "a->7", rule);
    testExpr(
      "update rule assignment",
      "A=a->7",
      comparator("=", id("A"), rule)
    );
  });
  describe("PrefixExpression", () => {
    testExpr("negative number", "-5.0", negative(number(5)));
    testExpr("negated identifier", "-x", negative(id("x")));
  });
  describe("ParenthesizedExpression", () => {
    testExpr("parenthesized number", "(5)", number(5));
    testExpr("point", "(2,3)", wrappedSeq(number(2), number(3)));
    const abc = bareSeq(
      updateRule(id("a"), number(2)),
      updateRule(id("b"), number(3)),
      updateRule(id("c"), number(4))
    );
    testExpr("unwrapped action sequence", "a->2,b->3,c->4", abc);
    testExpr(
      "unwrapped action sequence on RHS of equality",
      "A=a->2,b->3,c->4",
      comparator("=", id("A"), abc)
    );
    testExpr(
      "wrapped action sequence",
      "(a->2,b->3)",
      wrappedSeq(updateRule(id("a"), number(2)), updateRule(id("b"), number(3)))
    );
    testExpr(
      "function on points",
      "polygon((1,2),(3,4))",
      functionCall(id("polygon"), [
        wrappedSeq(number(1), number(2)),
        wrappedSeq(number(3), number(4)),
      ])
    );
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
    testExpr("dot access call on a function", "f(x).total()", {
      type: "DotAccess",
      object: functionCall(id("f"), [id("x")]),
      property: functionCall(id("total"), []),
    });
    testExpr("dot access call on a list", "[1,2,3,4,5,6].random(3)", {
      type: "DotAccess",
      object: list(...[1, 2, 3, 4, 5, 6].map(number)),
      property: functionCall(id("random"), [number(3)]),
    });
  });
  describe("ListAccessExpression", () => {
    testExpr("numeric index", "L[1]", {
      type: "ListAccess",
      list: id("L"),
      index: number(1),
    });
    testExpr("multiple numbers index", "L[1,2,3]", {
      type: "ListAccess",
      list: id("L"),
      index: list(number(1), number(2), number(3)),
    });
    testExpr("list index", "L[[1,2,3]]", {
      type: "ListAccess",
      list: id("L"),
      index: list(number(1), number(2), number(3)),
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
    testExpr("range in brackets", "L[[1...5]]", {
      type: "ListAccess",
      list: id("L"),
      index: {
        type: "Range",
        start: [number(1)],
        end: [number(5)],
      },
    });
    testExpr("list comprehension", "L[i+1 for i=M]", {
      type: "ListAccess",
      list: id("L"),
      index: {
        type: "ListComprehension",
        expr: binop("Add", id("i"), number(1)),
        assignments: [assignmentExpr(id("i"), id("M"))],
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
    testExpr("factorial", "x!", factorial(id("x")));
    testExpr("factorial", "factorial(x)", factorial(id("x")));
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
    testStmt("RGB color", `1 @{color: rgb(a,b,c)}`, {
      ...exprDefaults,
      color: functionCall(id("rgb"), [id("a"), id("b"), id("c")]),
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
    testStmt("Zero fill", `1 @{fill: 0}`, {
      ...exprDefaults,
      fillOpacity: number(0),
    });
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
    id: "1",
    pinned: false,
    secret: false,
    text: "abc",
  });
});

describe("Semicolons", () => {
  testStmt("No insertion in single-newline", `1 + \nx`, {
    ...exprDefaults,
    latex: binop("Add", number(1), id("x")),
  });
  testStmt(
    "Simple semi",
    `y=x\n\nx=1`,
    {
      ...exprDefaults,
      latex: comparator("=", id("y"), id("x")),
    },
    {
      ...exprDefaults,
      id: "2",
      color: "#2d70b3",
      latex: comparator("=", id("x"), number(1)),
    }
  );
  testStmt("Insertion inside folder", `folder "" {\ny=x\n\nx=1}`, {
    ...folderDefaults,
    title: "",
    children: [
      {
        ...exprDefaults,
        id: "2",
        color: "#c74440",
        latex: comparator("=", id("y"), id("x")),
      },
      {
        ...exprDefaults,
        id: "3",
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
        id: "2",
        latex: comparator("=", id("y"), id("x")),
      },
      {
        ...exprDefaults,
        id: "3",
        color: "#2d70b3",
        latex: comparator("=", id("x"), number(1)),
      },
    ],
  });
  testStmt("Newline gets ignored, even in CallExpression", `y=x\n(x)`, {
    ...exprDefaults,
    latex: comparator("=", id("y"), functionCall(id("x"), [id("x")])),
  });
  testStmt("Newline gets ignored, even in ListExpression", `[x,2]\n[x,1]`, {
    ...exprDefaults,
    latex: listAccess(list(id("x"), number(2)), list(id("x"), number(1))),
  });
  testStmt("Newline gets ignored, even in subtraction", `x\n-x`, {
    ...exprDefaults,
    latex: binop("Subtract", id("x"), id("x")),
  });
});

describe("Image", () => {
  testStmt("Plain image", `image "name" @{ url: "data:image/png,stub" }`, {
    type: "image",
    id: "1",
    pinned: false,
    secret: false,
    name: "name",
    image_url: "data:image/png,stub",
    width: number(10),
    height: number(10),
    center: wrappedSeq(number(0), number(0)),
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
      @{collapsed:true,secret:true,hidden:true}`,
    {
      type: "folder",
      id: "1",
      title: "Title",
      collapsed: true,
      hidden: true,
      secret: true,
      children: [],
    }
  );
});

describe("Ticker", () => {
  testStmt("Basic ticker", `ticker a -> a+1`, {
    handlerLatex: updateRule(id("a"), binop("Add", id("a"), number(1))),
    minStepLatex: number(0),
    playing: false,
  });
  testStmt("Ticker with comma", `ticker a -> a+1, A`, {
    handlerLatex: bareSeq(
      updateRule(id("a"), binop("Add", id("a"), number(1))),
      id("A")
    ),
    minStepLatex: number(0),
    playing: false,
  });
  testStmt("Styled ticker", `ticker a -> a+1 @{minStep: 100, playing: true}`, {
    handlerLatex: updateRule(id("a"), binop("Add", id("a"), number(1))),
    minStepLatex: number(100),
    playing: true,
  });
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
  test("Custom IDs work", () => {
    const [_errors, res] = textToAug(`
      folder "Title" {
        a @{ id: "custom-1" }
      } @{ id: "**dcg_geo_folder**" }

      table {
        x_1 = [1, 2, 3] @{ id: "_col-1" }
      } @{ id: "mytable" }
    `);
    expect(res).not.toBeNull();
    if (res === null) return;
    const exprs = res.expressions.list;
    expect(exprs[0]).toEqual({
      ...folderDefaults,
      id: "**dcg_geo_folder**",
      title: "Title",
      children: [
        {
          ...exprDefaults,
          latex: id("a"),
          id: "custom-1",
        },
      ],
    });
    expect(exprs[1]).toEqual({
      ...tableDefaults,
      id: "mytable",
      columns: [
        {
          ...columnDefaults,
          id: "_col-1",
          color: "#2d70b3",
          latex: id("x_1"),
          values: [number(1), number(2), number(3)],
        },
      ],
    });
  });
  test("Incremental IDs work", () => {
    const s = `
      |folder "a"| {
        |x|
      }

      |folder "Title" {|
        |y=x|

        |y=sin(x)| @{ id: "ee" }
      } @{ id: "**dcg_geo_folder**" }

      |table {|
        |x_1 = [1, 2, 3] @{ id: "_col-1" }|

        |x_2 = [3, 2, 1]|
      }
    `;
    const text = s.replace(/\|/g, "");
    const positions = [...s.matchAll(/\|/g)].map((m, i) => m.index! - i);
    const rawIDs = positions
      .filter((_, i) => i % 2 === 0)
      .map((x, i) => ({ from: x, to: positions[2 * i + 1], id: `raw-${i}` }));
    const [_errors, res] = textToAug(text, { rawIDs });
    expect(res).not.toBeNull();
    if (res === null) return;
    const exprs = res.expressions.list;
    expect(
      exprs.flatMap((e) => {
        const arr: (string | string[])[] = [e.id];
        arr.push(
          e.type === "folder"
            ? e.children.map((f) => f.id)
            : e.type === "table"
            ? e.columns.map((f) => f.id)
            : []
        );
        return arr;
      })
    ).toEqual([
      "raw-0",
      ["raw-1"],
      "**dcg_geo_folder**",
      ["raw-3", "ee"],
      "raw-5",
      ["_col-1", "raw-7"],
    ]);
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
      `y=1 @{color: "#FFF"};y=2 @{color: @{}}`,
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
    testDiagnostics("Invalid id: digits", `y=x @{id: "1"}`, [
      error(
        "Specified id must include a character other than a digit",
        pos(10, 13)
      ),
    ]);
    testDiagnostics("Invalid id: dunder", `y=x @{id: "__thing"}`, [
      error("Specified id must not start with '__'", pos(10, 19)),
    ]);
  });
  describe("Parse errors", () => {
    testDiagnostics("Empty program", `\n\n`, [
      warning("Program is empty. Try typing: y=x", undefined),
    ]);
    testDiagnostics("Skip node", `y=x @{} @! y=x^2`, [
      error("Invalid character @", pos(8, 9)),
      error(
        "Unexpected '!'. Did you mean to precede it by an expression, such as 'x!'?",
        pos(9, 10)
      ),
    ]);
    testDiagnostics("Multiple skips", `y=)x]`, [
      error("Unexpected text: ')'.", pos(2, 3)),
    ]);
    testDiagnostics("Multiple insertions", `y=(1+)*(5+)`, [
      error("Unexpected text: ')'.", pos(5, 6)),
    ]);
    testDiagnostics("Non-identifier callee", `y = 7(x)`, [
      error("Function call must be an identifier", pos(4, 5)),
    ]);
    testDiagnostics("Non-simple statement in table", `table { "note" }`, [
      error("Expected a valid table column. Try: x1 = [1, 2, 3]", pos(8, 14)),
    ]);
    testDiagnostics("Invalid regression body", `a ~ 5 #{ "note" }`, [
      error(
        "Regression mapping entry must be of the form 'name = 123'",
        pos(9, 15)
      ),
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
    testDiagnostics("Non-expression dot access", `table{}.x`, [
      error(
        "Unexpected '.'. Did you mean to precede it by an expression, such as '(2,3).x'?",
        pos(7, 8)
      ),
    ]);
    testDiagnostics("Non-expression list", `[table{}]`, [
      error(
        "Expected item in sequence to be an expression. Did you mean to write something like '[1,2,3]'?",
        pos(1, 8)
      ),
    ]);
    testDiagnostics("Non-expression piecewise", `{x>5:table{}}`, [
      error(
        "Expected branch of piecewise to be an expression. Did you mean to write something like '{x>3:5}'?",
        pos(5, 12)
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
    binop("Exponent", id("x"), factorial(id("y")))
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

describe("Funny spacing", () => {
  testStmt(
    "space before double-newline",
    "y=x \n\nx=3",
    {
      ...exprDefaults,
      latex: comparator("=", id("y"), id("x")),
    },
    {
      ...exprDefaults,
      id: "2",
      color: "#2d70b3",
      latex: comparator("=", id("x"), number(3)),
    }
  );
});
