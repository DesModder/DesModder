import { Calc } from "desmodder";

function replace(from: RegExp, to: string) {
  // replaceString is applied to stuff like labels
  // middle group in regex accounts for 1 layer of braces, sufficient for `Print ${a+2}`
  function replaceString(s: string) {
    // `from` should have "global" flag enabled in order to replace all
    return s.replace(/(?<=\$\{)((?:[^{}]|\{[^}]*\})+)(?=\})/g, (e) =>
      e.replace(from, to)
    );
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
        expr[k] = expr[k].replace(from, to);
      }
    });
    for (const sub of ["slider", "parametricDomain", "polarDomain"]) {
      if (expr[sub]) {
        ["max", "min", "step"].forEach((k) => {
          if (k in expr[sub]) {
            expr[sub][k] = expr[sub][k].replace(from, to);
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
            col[k] = col[k].replace(from, to);
          }
        });
        col.values = col.values.map((s: string) => s.replace(from, to));
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
              rule[k] = rule[k].replace(from, to);
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

export function refactor(fromExpr: string, toExpr: string) {
  // `\b` takes \w ≡ [A-Za-z0-9_] as word characters. (digits and underscores are included).
  // For a search key of "w", we want to match the "w" in "2w", so we can't use just `\b` at start
  // the positive lookahead and lookbehind are designed to (for a search of "w")
  //   match the "w" in "\\left(w,", "2w", "w", "w\\right)"
  //   not match the "w" in "P_{aww}", "w_{1}"
  // I'm not 100% sure these protect all use cases, but they do a decent job.
  // escapeRegExp needed for any input with parentheses, powers, etc.
  replace(
    RegExp(
      "(?<=\\b|\\d|\\W|^)" + escapeRegExp(fromExpr) + "(?=\\b|\\W|$)",
      "g"
    ),
    toExpr
  );
}
