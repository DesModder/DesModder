import { Calc, parseDesmosLatex } from "desmodder";
import traverse, { Path } from "parsing/traverse";
import { Identifier } from "parsing/parsenode";

function replace(replaceLatex: (s: string) => string) {
  // replaceString is applied to stuff like labels
  // middle group in regex accounts for 1 layer of braces, sufficient for `Print ${a+2}`
  function replaceString(s: string) {
    // `from` should have "global" flag enabled in order to replace all
    return s.replace(/(?<=\$\{)((?:[^{}]|\{[^}]*\})+)(?=\})/g, replaceLatex);
  }
  const simpleKeys = [
    "latex",
    "colorLatex",
    "pointOpacity",
    "lineOpacity",
    "pointSize",
    "lineWidth",
  ];
  const rootKeys = simpleKeys.concat([
    "labelSize",
    "labelAngle",
    "center",
    "opacity",
    "width",
    "height",
    "angle",
    "fillOpacity",
    "residualVariable",
    "fps",
  ]);
  const state = Calc.getState();
  state.expressions.list.forEach((expr: any) => {
    rootKeys.forEach((k) => {
      if (k in expr) {
        expr[k] = replaceLatex(expr[k]);
      }
    });
    for (const sub of ["slider", "parametricDomain", "polarDomain"]) {
      if (expr[sub]) {
        ["max", "min", "step"].forEach((k) => {
          if (k in expr[sub]) {
            expr[sub][k] = replaceLatex(expr[sub][k]);
          }
        });
      }
    }
    if (expr.label) {
      expr.label = replaceString(expr.label);
    }
    if (expr.columns) {
      expr.columns.forEach((col: any) => {
        simpleKeys.forEach((k) => {
          if (k in col) {
            col[k] = replaceLatex(col[k]);
          }
        });
        col.values = col.values.map(replaceLatex);
      });
    }
    if (expr.clickableInfo) {
      if (expr.clickableInfo.description) {
        expr.clickableInfo.description = replaceString(
          expr.clickableInfo.description
        );
      }
      if (expr.clickableInfo.rules) {
        expr.clickableInfo.rules.forEach((rule: any) => {
          ["assignment", "expression"].forEach((k) => {
            if (k in rule) {
              rule[k] = replaceLatex(rule[k]);
            }
          });
        });
      }
    }
  });
  Calc.setState(state, {
    allowUndo: true,
  });
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function refactor(from: string, replacement: string) {
  const fromParsed = parseDesmosLatex(from);
  if (fromParsed.type === "Identifier") {
    replace((s: string) => {
      const node = parseDesmosLatex(s);
      if (node.type === "Error") {
        return s;
      }
      const idPositions: {
        start: number;
        end: number;
        isDifferential: boolean;
      }[] = [];
      traverse(node, {
        exit(path: Path) {
          if (
            path.node.type === "Identifier" &&
            path.node._symbol === fromParsed._symbol
          ) {
            // A normal identifier
            idPositions.push({
              ...path.node.getInputSpan(),
              // It's actually a differential like dx
              // path.parent?.node.type === "Integral" && path.index === 0
              isDifferential:
                path.node._errorSymbol === "d" + path.node._symbol,
            });
          } else if (
            (path.node.type === "Assignment" ||
              path.node.type === "FunctionDefinition") &&
            path.node._symbol === fromParsed._symbol
          ) {
            // An assignment like a=5
            // LHS is an identifier, but it doesn't become an arg
            const span = path.node.getInputSpan();
            idPositions.push({
              // Need this code (imperfect) to handle funky input like
              // replacing "a_{0}" in "  a_{0}    =    72 "
              // TODO: better handling, and handle argSymbols in FunctionDefinition
              //    Maybe .asEquation() can help
              start: span.start,
              end: span.start + fromParsed._symbol.length,
              isDifferential: false,
            });
          }
        },
      });
      // args don't necessarily go in latex order
      const sorted = idPositions.sort((a, b) => a.start - b.start);
      let acc = "";
      let endIndex = 0;
      for (let { start, end, isDifferential } of sorted) {
        acc += s.slice(endIndex, start);
        if (isDifferential) {
          acc += "d";
        }
        acc += replacement;
        endIndex = end;
      }
      acc += s.slice(endIndex);
      return acc;
    });
  } else {
    const regex = RegExp(escapeRegExp(from), "g");
    replace((s: string) => s.replace(regex, replacement));
  }
}
