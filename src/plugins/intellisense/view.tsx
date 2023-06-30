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
import { identifierToString } from "plugins/text-mode/aug/augLatexToRaw";
import { textModeExprToLatex } from "plugins/text-mode/down/textToRaw";
import { IndexFor } from "utils/utilComponents";

export interface JumpToDefinitionMenuInfo {
  idents: {
    ident: BoundIdentifier;
    sourceExprLatex: string;
    sourceExprIndex: number;
    sourceExprId: string;
  }[];
  varName: string;
}

export class JumpToDefinitionMenu extends Component<{
  info: () => JumpToDefinitionMenuInfo | undefined;
  jumpToDefinitionById: (id: string) => void;
  closeJumpToDefinitionMenu: () => void;
  jumpToDefIndex: () => number;
}> {
  template() {
    return (
      <If predicate={() => this.props.info()}>
        {() => (
          <div class="dsm-intellisense-jump-to-def-menu">
            <div class="dsm-intellisense-header">
              <span>
                <DStaticMathquillView
                  config={{}}
                  latex={() =>
                    identifierToString({
                      type: "Identifier",
                      symbol: this.props.info()?.varName ?? "",
                    })
                  }
                ></DStaticMathquillView>{" "}
                has multiple definitions. Pick one to jump to below.
              </span>
              <button
                onClick={() => {
                  this.props.closeJumpToDefinitionMenu();
                }}
                class="dcg-icon-remove"
              ></button>
            </div>
            <For
              each={() =>
                this.props.info()?.idents?.map((e, i) => [e, i] as const) ?? []
              }
              key={(e) => e[0].sourceExprIndex}
            >
              <ul>
                {([e, i]: [
                  JumpToDefinitionMenuInfo["idents"][number],
                  number
                ]) => {
                  return (
                    <li
                      onClick={() => {
                        this.props.jumpToDefinitionById(e.sourceExprId);
                      }}
                      class={() =>
                        i === this.props.jumpToDefIndex() ? "selected" : ""
                      }
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
        )}
      </If>
    );
  }
}

export function identifierStringToLatexString(str: string) {
  return identifierToString({
    symbol: str,
    type: "Identifier",
  });
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
                      identifierStringToLatexString(
                        this.props.selectedParam()
                      ) !== ltx()
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
      <If predicate={() => this.props.partialFunctionCall()}>
        {() => (
          <div>
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
                            identifierStringToLatexString(p[0]) +
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
        )}
      </If>
    );
  }
}

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
  jumpToDefinitionById: (str: string) => void;
  jumpToDefState: () => JumpToDefinitionMenuInfo;
  closeJumpToDefinitionMenu: () => void;
  jumpToDefIndex: () => number;
}> {
  template() {
    return (
      <div>
        <JumpToDefinitionMenu
          info={() => this.props.jumpToDefState()}
          jumpToDefinitionById={(id: string) =>
            this.props.jumpToDefinitionById(id)
          }
          closeJumpToDefinitionMenu={this.props.closeJumpToDefinitionMenu}
          jumpToDefIndex={() => this.props.jumpToDefIndex()}
        ></JumpToDefinitionMenu>
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
          <PartialFunctionCallView {...this.props} />
          <IndexFor
            each={() =>
              this.props.idents().map((ident, index) => ({ ...ident, index }))
            }
            key={(e) => e.idents[0].variableName}
            innerComponent={intellisenseOptionsTable}
          >
            {(
              ident: { idents: BoundIdentifier[] } & { index: number },
              idx: () => number
            ) => {
              const reformattedIdent = identifierStringToLatexString(
                ident.idents[0].variableName
              );

              const opt = (
                <tr
                  class={() =>
                    (idx() === this.props.index()
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
          </IndexFor>
        </div>
      </div>
    );
  }
}

function intellisenseOptionsTable(children: unknown) {
  return <table class="intellisense-options-table">{children}</table>;
}
