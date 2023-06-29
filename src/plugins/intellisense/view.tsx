import { BoundIdentifier, BoundIdentifierFunction } from ".";
import { DStaticMathquillView, If } from "../../components/desmosComponents";
import {
  DocStringRenderable,
  parseDocstring,
  tokenizeDocstring,
} from "./docstring";
import { PartialFunctionCall } from "./latex-parsing";
import "./view.less";
import { Component, jsx } from "DCGView";
import { For, StaticMathQuillView, Switch } from "components";
import { latexTreeToString } from "plugins/text-mode/aug/augLatexToRaw";
import { childExprToAug } from "plugins/text-mode/down/astToAug";
import { parse } from "plugins/text-mode/down/textToAST";

export interface JumpToDefinitionMenuInfo {
  idents: {
    ident: BoundIdentifier;
    sourceExprLatex: string;
    sourceExprIndex: number;
    sourceExprId: string;
  }[];
}

export class JumpToDefinitionMenu extends Component<{
  info: () => JumpToDefinitionMenuInfo;
  jumpToDefinition: (id: string) => void;
}> {
  template() {
    return (
      <div>
        <For
          each={() => this.props.info().idents}
          key={(e) => e.sourceExprIndex}
        >
          <ul>
            {(e: JumpToDefinitionMenuInfo["idents"][number]) => {
              return (
                <li
                  onClick={() => {
                    this.props.jumpToDefinition(e.sourceExprId);
                  }}
                >
                  <DStaticMathquillView
                    latex={() => e.sourceExprLatex}
                    config={{}}
                  ></DStaticMathquillView>
                </li>
              );
            }}
          </ul>
        </For>
      </div>
    );
  }
}

export function addBracketsToIdent(str: string) {
  const [str1, str2] = str.split("_");

  const varStart = str1.length === 1 ? str1 : "\\" + str1;

  if (!str2) return varStart;

  return varStart + `_{${str2}}`;
}

function latexForType(type: BoundIdentifier["type"]) {
  return {
    variable: "x=",
    function: "f",
    "function-param": "\\leftx\\right)",
    "listcomp-param": "\\left[\\operatorname{for}\\right",
    derivative: "\\frac{d}{dx}",
    "repeated-operator": "\\Sigma",
    substitution: "\\operatorname{with}",
  }[type];
}

export class IdentifierSymbol extends Component<{
  symbol: () => { idents: BoundIdentifier[] };
}> {
  template() {
    if (this.props.symbol().idents.length > 1) {
      return (
        <StaticMathQuillView
          latex={`${this.props.symbol().idents.length}\\ \\mathrm{defs}`}
        ></StaticMathQuillView>
      );
    }

    return (
      <StaticMathQuillView
        latex={latexForType(this.props.symbol().idents[0].type)}
      ></StaticMathQuillView>
    );
  }
}

export function textModeExprToLatex(tmExpr: string) {
  const parsedTextMode = parse(tmExpr);
  const parsedExpr = parsedTextMode.mapIDstmt[1];
  if (parsedExpr && parsedExpr.type === "ExprStatement") {
    const aug = childExprToAug(parsedExpr.expr);
    const latex = latexTreeToString(aug);
    return latex;
  }
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
        <div style={{ display: "inline" }} class="dsm-intellisense-docstring">
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

let counter2 = 0;

export class View extends Component<{
  x: () => number;
  y: () => number;
  idents: () => { idents: BoundIdentifier[] }[];
  autocomplete: (option: BoundIdentifier) => void;
  index: () => number;
  partialFunctionCall: () => PartialFunctionCall | undefined;
  partialFunctionCallIdent: () => BoundIdentifierFunction | undefined;
  partialFunctionCallDoc: () => string | undefined;
  show: () => boolean;
  jumpToDefinition: (str: string) => void;
}> {
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
        <PartialFunctionCallView {...this.props}/>`
        <For
          each={() =>
            this.props.idents().map((ident, index) => ({ ...ident, index }))
          }
          key={() => counter2++}
        >
          <table class="intellisense-options-table">
            {(ident: { idents: BoundIdentifier[] } & { index: number }) => {
              const reformattedIdent = addBracketsToIdent(
                ident.idents[0].variableName
              );

              const opt = (
                <tr
                  class={() =>
                    (ident.index === this.props.index()
                      ? (setTimeout(() => {
                          opt._domNode?.scrollIntoView({
                            block: "center",
                          });
                        }, 0),
                        "selected-intellisense-option")
                      : "not-selected-intellisense-option") +
                    " intellisense-option"
                  }
                  onClick={() => {
                    this.props.autocomplete(ident.idents[0]);
                  }}
                >
                  <td style={{ color: "#AAAAAA" }}>
                    <IdentifierSymbol symbol={() => ident}></IdentifierSymbol>
                  </td>
                  <td>
                    <StaticMathQuillView
                      latex={
                        reformattedIdent +
                        (ident.idents.length === 1 &&
                        ident.idents[0].type === "function"
                          ? "\\left(\\right)"
                          : "")
                      }
                    ></StaticMathQuillView>
                  </td>
                  <td>
                    <i
                      onClick={(e: MouseEvent) => {
                        this.props.jumpToDefinition(reformattedIdent);
                        e.stopPropagation();
                      }}
                      class="dsm-icon-compass2 jump-to-def-btn"
                    ></i>
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
