import { Calc } from "globals/window";
import { satisfiesType } from "parsing/nodeTypes";
import { Identifier } from "parsing/parsenode";
import traverse, { Path } from "parsing/traverse";
import { parseDesmosLatex } from "utils/depUtils";

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
  const ticker = state.expressions.ticker;
  if (ticker?.handlerLatex !== undefined) {
    ticker.handlerLatex = replaceLatex(ticker.handlerLatex);
  }
  if (ticker?.minStepLatex !== undefined) {
    ticker.minStepLatex = replaceLatex(ticker.minStepLatex);
  }
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
        if (col.values) col.values = col.values.map(replaceLatex);
      });
    }
    if (expr.clickableInfo?.latex) {
      expr.clickableInfo.latex = replaceLatex(expr.clickableInfo.latex);
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

function getReplacements(
  path: Path,
  fromParsed: Identifier,
  from: string,
  to: string
) {
  let span, line;
  switch (path.node.type) {
    case "Identifier":
      if (path.node._symbol === fromParsed._symbol) {
        // A normal identifier
        return [
          {
            ...path.node.getInputSpan(),
            // If True → it's actually a differential like dx
            // path.parent?.node.type === "Integral" && path.index === 0
            replacement:
              path.node._errorSymbol === "d" + path.node._symbol
                ? "d" + to
                : to,
          },
        ];
      }
      break;
    case "FunctionCall":
      if (path.node._symbol === fromParsed._symbol) {
        span = path.node.getInputSpan();
        return [
          {
            start: span.start,
            end: span.start + from.length,
            replacement: to,
          },
        ];
      }
      break;
    case "Assignment":
    case "FunctionDefinition": {
      span = path.node.getInputSpan();
      line = path.node.getInputString();
      const eqIndex = line.indexOf("=");
      return [
        {
          // Need this code (imperfect) to handle funky input like
          // replacing "a_{0}" in "  a_{0}    =    72 "
          start: span.start,
          end: span.start + eqIndex,
          replacement: line
            .slice(0, eqIndex)
            .replace(
              RegExp(
                String.raw`(?<=([,(]|^)(\s|\\ )*)` +
                  escapeRegExp(from) +
                  String.raw`(?=(\s|\\ )*((\\left)?\(|(\\right)?\)|,|$))`,
                "g"
              ),
              to
            ),
        },
      ];
    }
    case "Derivative": {
      span = path.node.getInputSpan();
      line = path.node.getInputString();
      const diffBottomStr = `{d${from}}`;
      const diffBottomStart = line.indexOf(diffBottomStr);
      return [
        {
          start: span.start + diffBottomStart,
          end: span.start + diffBottomStart + diffBottomStr.length,
          replacement: `{d${to}}`,
        },
      ];
    }
  }
  return [];
}

export function refactor(from: string, to: string) {
  const fromParsed = parseDesmosLatex(from.trim());
  if (satisfiesType(fromParsed, "Identifier")) {
    // trim `from` to prevent inputs such as "  a" messing up matches that depend on `from` itself.
    from = from.trim();
    replace((s: string) => {
      const node = parseDesmosLatex(s);
      if (satisfiesType(node, "Error")) {
        return s;
      }
      const idPositions: {
        start: number;
        end: number;
        replacement: string;
      }[] = [];
      traverse(node, {
        exit(path: Path) {
          idPositions.push(...getReplacements(path, fromParsed, from, to));
        },
      });
      // args don't necessarily go in latex order
      const sorted = idPositions.sort((a, b) => a.start - b.start);
      let acc = "";
      let endIndex = 0;
      for (const { start, end, replacement } of sorted) {
        // Conditional start >= endIndex to avoid double-replacement of the middle value
        // in And(Inequality, Inequality) which were not transformed to DoubleInequality.
        if (start >= endIndex) {
          acc += s.slice(endIndex, start);
          acc += replacement;
        }
        endIndex = end;
      }
      acc += s.slice(endIndex);
      return acc;
    });
  } else {
    const regex = RegExp(escapeRegExp(from), "g");
    replace((s: string) => s.replace(regex, to));
  }
}
