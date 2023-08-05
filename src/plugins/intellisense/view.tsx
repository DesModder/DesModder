import Intellisense, { BoundIdentifier, BoundIdentifierFunction } from ".";
import {
  Config,
  identifierToString,
  textModeExprToLatex,
} from "../../../text-mode-core";
import { DStaticMathquillView, If } from "../../components/desmosComponents";
import {
  DocStringRenderable,
  parseDocstring,
  tokenizeDocstring,
} from "./docstring";
import { PartialFunctionCall } from "./latex-parsing";
import { setIntellisenseTimeout } from "./utils";
import "./view.less";
import { ClassComponent, Component, jsx } from "DCGView";
import { For, StaticMathQuillView, Switch } from "components";
import { format } from "i18n/i18n-core";
import { parseDesmosLatex } from "utils/depUtils";
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
  cfg: () => Config;
}> {
  template() {
    return (
      <If predicate={() => this.props.info()}>
        {() => {
          const elt = (
            <div class="dsm-intellisense-jump-to-def-menu" tabindex={-1}>
              <div class="dsm-intellisense-header">
                <span>
                  <DStaticMathquillView
                    config={{}}
                    latex={() =>
                      identifierStringToLatexString(
                        this.props.cfg(),
                        this.props.info()?.varName ?? ""
                      )
                    }
                  ></DStaticMathquillView>{" "}
                  {format("intellisense-jump2def-menu-instructions")}
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
                  this.props.info()?.idents?.map((e, i) => [e, i] as const) ??
                  []
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
          );

          setIntellisenseTimeout(() => {
            elt._domNode?.focus?.();
          });

          return elt;
        }}
      </If>
    );
  }
}

function identifierStringToLatexString(cfg: Config, str: string) {
  return identifierToString(cfg, {
    symbol: str,
    type: "Identifier",
  });
}

export function latexStringToIdentifierString(str: string) {
  if (str.slice(1, 5) === "_{ }") return str[0];
  const ltx = parseDesmosLatex(str);
  if (ltx.type === "Identifier") return ltx._symbol;
  return undefined;
}

function latexForType(type: BoundIdentifier["type"]) {
  return {
    variable: "x=",
    function: "f",
    "function-param": "\\left(x\\right)",
    "listcomp-param": "\\left[\\operatorname{for}\\right]",
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
  cfg: () => Config;
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
                    const ltx = () =>
                      textModeExprToLatex(this.props.cfg(), r.latex) ?? r.latex;

                    if (
                      identifierStringToLatexString(
                        this.props.cfg(),
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
                          cfg={this.props.cfg}
                        ></FormattedDocstring>
                      </div>
                    );
                  }
                  case "text":
                    return <span>{() => r.str}</span>;
                  case "math":
                    return (
                      <DStaticMathquillView
                        latex={() =>
                          textModeExprToLatex(this.props.cfg(), r.latex) ??
                          r.latex
                        }
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
  cfg: () => Config;
}> {
  template() {
    return (
      <If predicate={() => this.props.partialFunctionCall()}>
        {() => {
          const elt: ClassComponent = (
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
                    cfg={this.props.cfg}
                  ></FormattedDocstring>
                )}
              </If>
              <div class="pfc-latex">
                <DStaticMathquillView
                  latex={() => {
                    return identifierStringToLatexString(
                      this.props.cfg(),
                      this.props.partialFunctionCall()?.ident ?? ""
                    );
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
                            this.props.partialFunctionCall()?.paramIndex ===
                            p[1]
                              ? "pfc-param-selected"
                              : "pfc-param"
                          }
                        >
                          <DStaticMathquillView
                            config={{}}
                            latex={() =>
                              identifierStringToLatexString(
                                this.props.cfg(),
                                p[0]
                              ) +
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
          return elt;
        }}
      </If>
    );
  }
}

export class View extends Component<{
  plugin: () => Intellisense;
}> {
  template() {
    return (
      <div>
        <JumpToDefinitionMenu
          info={() => this.props.plugin().jumpToDefState}
          jumpToDefinitionById={(id: string) =>
            this.props.plugin().jumpToDefinitionById(id)
          }
          closeJumpToDefinitionMenu={() =>
            this.props.plugin().closeJumpToDefMenu()
          }
          jumpToDefIndex={() => this.props.plugin().jumpToDefIndex}
          cfg={() => this.props.plugin().intellisenseState.cfg}
        ></JumpToDefinitionMenu>
        <div
          id="intellisense-container"
          class={() =>
            this.props.plugin().intellisenseIndex >= 0
              ? "selected-intellisense-container"
              : ""
          }
          style={() => ({
            top: (this.props.plugin().y + 30).toString() + "px",
            left: this.props.plugin().x.toString() + "px",
            display:
              (this.props.plugin().intellisenseOpts.length > 0 ||
                this.props.plugin().partialFunctionCall) &&
              this.props.plugin().canHaveIntellisense
                ? "block"
                : "none",
            transform:
              this.props.plugin().y > window.innerHeight / 2
                ? `translateY(calc(-100% - 50px))`
                : "",
          })}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
          }}
        >
          <PartialFunctionCallView
            partialFunctionCall={() => this.props.plugin().partialFunctionCall}
            partialFunctionCallDoc={() =>
              this.props.plugin().partialFunctionCallDoc
            }
            partialFunctionCallIdent={() =>
              this.props.plugin().partialFunctionCallIdent
            }
            cfg={() => this.props.plugin().intellisenseState.cfg}
          />
          <IndexFor
            each={() =>
              this.props
                .plugin()
                .intellisenseOpts.map((ident, index) => ({ ...ident, index }))
            }
            key={(e) => e.idents[0].variableName}
            innerComponent={intellisenseOptionsTable}
          >
            {(
              ident: { idents: BoundIdentifier[] } & { index: number },
              idx: () => number
            ) => {
              const reformattedIdent = ident.idents[0].variableName;

              const selected = () =>
                idx() === this.props.plugin().intellisenseIndex;

              const opt = (
                <tr
                  class={() =>
                    selected()
                      ? (setIntellisenseTimeout(() => {
                          opt._domNode?.scrollIntoView({
                            block: "center",
                          });
                        }, 0),
                        "selected-intellisense-row intellisense-option")
                      : "intellisense-option"
                  }
                >
                  <td style={{ color: "#AAAAAA" }}>
                    <IdentifierSymbol symbol={() => ident}></IdentifierSymbol>
                  </td>
                  <td
                    class={() =>
                      selected() && this.props.plugin().intellisenseRow === 0
                        ? "selected-intellisense-option"
                        : "intellisense-clickable"
                    }
                    onClick={() => {
                      this.props.plugin().leaveIntellisenseMenu();
                      this.props.plugin().doAutocomplete(ident.idents[0]);
                    }}
                  >
                    <StaticMathQuillView
                      latex={
                        identifierStringToLatexString(
                          this.props.plugin().intellisenseState.cfg,
                          reformattedIdent
                        ) +
                        (ident.idents.length === 1 &&
                        ident.idents[0].type === "function"
                          ? "\\left(\\right)"
                          : "")
                      }
                    ></StaticMathQuillView>
                  </td>
                  <td
                    class={() =>
                      selected() && this.props.plugin().intellisenseRow === 1
                        ? "selected-intellisense-option"
                        : "intellisense-clickable"
                    }
                  >
                    <i
                      onClick={(e: MouseEvent) => {
                        this.props.plugin().jumpToDefinition(reformattedIdent);
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
