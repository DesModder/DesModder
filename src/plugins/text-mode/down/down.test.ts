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
  describe("Basic booleans", () => {
    testStmt("Hidden", `calc 1 @{id:"1",color:"#FFF"}`, {
      ...exprDefaults,
      hidden: true,
    });
    testStmt("Secret", `show 1 @{id:"1",color:"#FFF",secret:true}`, {
      ...exprDefaults,
      secret: true,
    });
    testStmt(
      "Fraction",
      `show 1 @{id:"1",color:"#FFF",displayEvaluationAsFraction:true}`,
      {
        ...exprDefaults,
        displayEvaluationAsFraction: true,
      }
    );
    testStmt("Error hidden", `show 1 @{id:"1",color:"#FFF",errorHidden:true}`, {
      ...exprDefaults,
      errorHidden: true,
    });
    testStmt("Glesmos", `show 1 @{id:"1",color:"#FFF",glesmos:true}`, {
      ...exprDefaults,
      glesmos: true,
    });
    testStmt("Pinned", `show 1 @{id:"1",color:"#FFF",pinned:true}`, {
      ...exprDefaults,
      pinned: true,
    });
  });
  describe("Label", () => {
    testStmt(
      "Label text",
      `show 1 @{id:"1",color:"#FFF",label:@{text:"hello"}}`,
      {
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
      }
    );
    testStmt(
      "Full label info",
      `show 1 @{
        id:"1",
        color:"#FFF",
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
});

const tableDefaults = {
  type: "table",
  id: "1",
  pinned: false,
  secret: false,
};

describe("Tables", () => {
  testStmt(
    "Value list",
    `table { calc [1,2,3] @{id:"2",color:"#FFF"} } @{id:"1"}`,
    {
      ...tableDefaults,
      columns: [
        {
          values: [number(1), number(2), number(3)],
          color: "#FFF",
          hidden: false,
          id: "2",
        },
      ],
    }
  );
  testStmt(
    "Expression",
    `table { calc L+1 @{id:"2",color:"#FFF"} } @{id:"1"}`,
    {
      ...tableDefaults,
      columns: [
        {
          latex: binop("Add", id("L"), number(1)),
          values: [],
          color: "#FFF",
          hidden: false,
          id: "2",
        },
      ],
    }
  );
  testStmt(
    "Assignment",
    `table { let a=[1,2,3] @{id:"2",color:"#FFF"} } @{id:"1"}`,
    {
      ...tableDefaults,
      columns: [
        {
          latex: id("a"),
          values: [number(1), number(2), number(3)],
          color: "#FFF",
          hidden: false,
          id: "2",
        },
      ],
    }
  );
});

describe("Text", () => {
  testStmt("Text", `"abc" @{id:"1"}`, {
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
        id: "1",
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
      show 1 @{id:"2",color:"#A"}
    } @{id:"1"}`,
    {
      type: "folder",
      id: "1",
      title: "Title",
      collapsed: false,
      hidden: false,
      pinned: false,
      secret: false,
      children: [
        {
          ...exprDefaults,
          id: "2",
          color: "#A",
        },
      ],
    }
  );
  testStmt(
    "Folder options",
    `folder "Title" {}
      @{id:"1",pinned:true,collapsed:true,secret:true,hidden:true}`,
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

describe("Settings", () => {
  testSettings(
    "No settings expr",
    `show 1 @{id:"1",color:"#FFF"}`,
    defaultSettings
  );
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
