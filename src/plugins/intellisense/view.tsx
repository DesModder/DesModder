import { BoundIdentifier, BoundIdentifierFunction } from ".";
import { DStaticMathquillView, If } from "../../components/desmosComponents";
import { PartialFunctionCall } from "./latex-parsing";
import "./view.less";
import { Component, jsx } from "DCGView";
import { For, StaticMathQuillView, Switch } from "components";
import { latexTreeToString } from "plugins/text-mode/aug/augLatexToRaw";
import { childExprToAug } from "plugins/text-mode/down/astToAug";
import { parse } from "plugins/text-mode/down/textToAST";

export function addBracketsToIdent(str: string) {
  // if (str.length === 1) return str;

  // return str[0] + "_{" + str.slice(2) + "}";
  const [str1, str2] = str.split("_");

  const varStart = str1.length === 1 ? str1 : "\\" + str1;

  if (!str2) return varStart;

  return varStart + `_{${str2}}`;
}

export class IdentifierSymbol extends Component<{
  symbol: () => BoundIdentifier["type"];
}> {
  template() {
    switch (this.props.symbol()) {
      case "variable":
        return <StaticMathQuillView latex={"x="}></StaticMathQuillView>;
      case "function":
        return <StaticMathQuillView latex={"f"}></StaticMathQuillView>;
      case "function-param":
        return (
          <StaticMathQuillView latex={"\\left(x\\right)"}></StaticMathQuillView>
        );
      case "listcomp-param":
        return (
          <StaticMathQuillView
            latex={"\\left[\\operatorname{for}\\right]"}
          ></StaticMathQuillView>
        );
      case "derivative":
        return (
          <StaticMathQuillView latex={"\\frac{d}{dx}"}></StaticMathQuillView>
        );
      case "repeated-operator":
        return <StaticMathQuillView latex={"\\sigma"}></StaticMathQuillView>;
    }
  }
}

const lastof = function <T>(arr: T[]) {
  return arr[arr.length - 1];
};

function tokenizeDocstring(str: string): DocStringToken[] {
  const tokens: DocStringToken[] = [
    {
      str: "",
      type: "text",
    },
  ];

  let i = 0;

  const match = (rgx: RegExp) => {
    const match = str.slice(i).match(rgx);
    if (match) {
      i += match[0].length - 1;
      return match[0];
    }
    return undefined;
  };

  for (i = 0; i < str.length; i++) {
    const mathStr = match(/^`[^`]+`/g);
    if (mathStr) {
      tokens.push(
        {
          str: mathStr.slice(1, -1),
          type: "math",
        },
        { str: "", type: "text" }
      );
      continue;
    }

    const paramStr = match(/^@\w+/g);
    if (paramStr) {
      tokens.push(
        {
          str: paramStr.slice(1),
          type: "param",
        },
        { str: "", type: "text" }
      );
      continue;
    }

    lastof(tokens).str += str[i];
  }

  return tokens;
}

function textModeExprToLatex(tmExpr: string) {
  const parsedTextMode = parse(tmExpr);
  const parsedExpr = parsedTextMode.mapIDstmt[1];
  if (parsedExpr && parsedExpr.type === "ExprStatement") {
    const aug = childExprToAug(parsedExpr.expr);
    const latex = latexTreeToString(aug);
    return latex;
  }
}

function parseDocstring(tokens: DocStringToken[]): DocStringRenderable[] {
  const renderables: DocStringRenderable[] = [];

  function getNoParamRenderable(t: DocStringToken): DocStringRenderableNoParam {
    switch (t.type) {
      case "text":
        return t as { type: "text"; str: string };
      case "math":
        return { type: "math", latex: t.str };
      case "param":
        throw new Error("unreachable");
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t.type) {
      case "text":
      case "math":
        renderables.push(getNoParamRenderable(t));
        break;
      case "param": {
        const paramBody: DocStringRenderableNoParam[] = [];
        while (i < tokens.length - 1) {
          i++;
          const t2 = tokens[i];
          if (t2.type === "param") {
            i--;
            break;
          }
          paramBody.push(getNoParamRenderable(t2));
        }
        renderables.push({
          type: "param",
          latex: t.str,
          renderables: paramBody,
        });
      }
    }
  }

  return renderables;
}

type DocStringRenderableNoParam =
  | {
      str: string;
      type: "text";
    }
  | {
      latex: string;
      type: "math";
    };

type DocStringRenderable =
  | {
      type: "param";
      latex: string;
      renderables: DocStringRenderableNoParam[];
    }
  | DocStringRenderableNoParam;

interface DocStringToken {
  str: string;
  type: "text" | "math" | "param";
}

let counter = 0;

export class FormattedDocstring extends Component<{
  docstring: () => DocStringRenderable[];
  selectedParam: () => string;
}> {
  template() {
    return (
      <For
        each={() => this.props.docstring().map((e, i) => [e, i] as const)}
        key={() => counter++}
      >
        <div style={{ display: "inline" }}>
          {([r, _]: [DocStringRenderable, number]) => (
            <Switch key={() => r}>
              {() => {
                switch (r.type) {
                  case "param": {
                    const ltx = () => textModeExprToLatex(r.latex) ?? r.latex;

                    if (
                      addBracketsToIdent(this.props.selectedParam()) !== ltx()
                    ) {
                      return <span></span>;
                    }
                    return (
                      <div class="pfc-doc-param">
                        <DStaticMathquillView
                          latex={ltx}
                          config={{}}
                        ></DStaticMathquillView>{" "}
                        -
                        <FormattedDocstring
                          selectedParam={this.props.selectedParam}
                          docstring={() => r.renderables}
                        ></FormattedDocstring>
                      </div>
                    );
                  }
                  case "text":
                    return <span>{() => r.str}</span>;
                  case "math":
                    return (
                      <DStaticMathquillView
                        latex={() => textModeExprToLatex(r.latex) ?? r.latex}
                        config={{}}
                      ></DStaticMathquillView>
                    );
                }
              }}
            </Switch>
          )}
        </div>
      </For>
    );
  }
}

export class PartialFunctionCallView extends Component<{
  partialFunctionCall: () => PartialFunctionCall | undefined;
  partialFunctionCallIdent: () => BoundIdentifierFunction | undefined;
  partialFunctionCallDoc: () => string | undefined;
}> {
  init() {}

  template() {
    return (
      <div
        style={() => ({
          display: this.props.partialFunctionCall() ? undefined : "none",
        })}
        class="partial-function-call-container"
      >
        <If predicate={() => this.props.partialFunctionCallDoc()}>
          {() => (
            <FormattedDocstring
              docstring={() =>
                parseDocstring(
                  tokenizeDocstring(
                    this.props.partialFunctionCallDoc() as string
                  )
                )
              }
              selectedParam={() =>
                this.props.partialFunctionCallIdent()?.params?.[
                  this.props.partialFunctionCall()?.paramIndex ?? 0
                ] ?? ""
              }
            ></FormattedDocstring>
          )}
        </If>
        <div class="pfc-latex">
          <DStaticMathquillView
            latex={() => {
              return this.props.partialFunctionCall()?.ident ?? "";
            }}
            config={{}}
          ></DStaticMathquillView>
          <StaticMathQuillView latex="("></StaticMathQuillView>
          <For
            each={() =>
              this.props
                .partialFunctionCallIdent()
                ?.params.map((e, i) => [e, i] as const) ?? []
            }
            key={(e) => e[0]}
          >
            <div class="pfc-params">
              {(p: [string, number]) => {
                return (
                  <div
                    class={() =>
                      this.props.partialFunctionCall()?.paramIndex === p[1]
                        ? "pfc-param-selected"
                        : "pfc-param"
                    }
                  >
                    <DStaticMathquillView
                      config={{}}
                      latex={() =>
                        addBracketsToIdent(p[0]) +
                        (p[1] ===
                        (this.props.partialFunctionCallIdent()?.params
                          ?.length ?? 0) -
                          1
                          ? ""
                          : ",")
                      }
                    ></DStaticMathquillView>
                  </div>
                );
              }}
            </div>
          </For>
          <StaticMathQuillView latex=")"></StaticMathQuillView>
        </div>
      </div>
    );
  }
}

export class View extends Component<{
  x: () => number;
  y: () => number;
  idents: () => BoundIdentifier[];
  autocomplete: (option: BoundIdentifier) => void;
  index: () => number;
  partialFunctionCall: () => PartialFunctionCall | undefined;
  partialFunctionCallIdent: () => BoundIdentifierFunction | undefined;
  partialFunctionCallDoc: () => string | undefined;
  show: () => boolean;
}> {
  init() {}

  template() {
    return (
      <div
        id="intellisense-container"
        class={() =>
          this.props.index() >= 0 ? "selected-intellisense-container" : ""
        }
        style={() => ({
          top: (this.props.y() + 30).toString() + "px",
          left: this.props.x().toString() + "px",
          display:
            (this.props.idents().length > 0 ||
              this.props.partialFunctionCall()) &&
            this.props.show()
              ? "block"
              : "none",
          transform:
            this.props.y() > window.innerHeight / 2
              ? `translateY(calc(-100% - 50px))`
              : "",
        })}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
      >
        <PartialFunctionCallView
          partialFunctionCall={() => this.props.partialFunctionCall()}
          partialFunctionCallIdent={() => this.props.partialFunctionCallIdent()}
          partialFunctionCallDoc={() => this.props.partialFunctionCallDoc()}
        ></PartialFunctionCallView>
        <For
          each={() =>
            this.props.idents().map((ident, index) => ({ ...ident, index }))
          }
          key={(e) => e.id}
        >
          <table class="intellisense-options-table">
            {(ident: BoundIdentifier & { index: number }) => {
              const reformattedIdent = addBracketsToIdent(ident.variableName);

              const isSelected = () => ident.index === this.props.index();

              const opt = (
                <tr
                  class={() =>
                    isSelected()
                      ? (setTimeout(
                          () =>
                            opt._domNode?.scrollIntoView({
                              block: "center",
                            }),
                          0
                        ),
                        "selected-intellisense-option")
                      : "intellisense-option"
                  }
                  onClick={() => {
                    this.props.autocomplete(ident);
                  }}
                >
                  <td style={{ color: "#AAAAAA" }}>
                    <IdentifierSymbol
                      symbol={() => ident.type}
                    ></IdentifierSymbol>
                  </td>
                  <td>
                    <StaticMathQuillView
                      latex={
                        reformattedIdent +
                        (ident.type === "function" ? "\\left(\\right)" : "")
                      }
                    ></StaticMathQuillView>
                  </td>
                </tr>
              );

              return opt;
            }}
          </table>
        </For>
      </div>
    );
  }
}
