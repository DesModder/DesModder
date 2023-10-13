import MyExpressionsLibrary, {
  ExpressionLibraryExpression,
  ExpressionLibraryFolder,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
} from ".";
import "./library-search.less";
import { Component, jsx, mountToNode } from "#DCGView";
import { For, If, IfElse, StaticMathQuillView, Switch } from "#components";
import { format } from "#i18n";
import { ExpressionState } from "@desmodder/graph-state";
import { GraphValidity, LazyLoadableGraph } from "./lazy-loadable-graph";

export function expressionLibraryMathExpressionView(
  expr: ExpressionLibraryMathExpression,
  observer: IntersectionObserver,
  container: any
) {
  // has to happen in a timeout since dom nodes aren't created immediately
  setTimeout(() => {
    const domNode = container._domNode as HTMLLIElement;

    // @ts-expect-error convenient way of passing handler into intersectionobserver
    domNode._onEnterView = () => {
      mountToNode(StaticMathQuillView, domNode, {
        latex: () => expr.latex ?? "",
      });
      observer.unobserve(domNode);
    };

    observer.observe(domNode);
  }, 0);
}

class LibrarySearchElement extends Component<{
  plugin: () => MyExpressionsLibrary;
  expr: () => ExpressionLibraryMathExpression | ExpressionLibraryFolder;
  graph: () => ExpressionLibraryGraph;
  observer: () => IntersectionObserver;
}> {
  template() {
    return (
      <Switch key={() => this.props.expr().type}>
        {() => {
          const expr = this.props.expr();

          // folder expression in the myexprlib menu
          if (expr.type === "folder") {
            return (
              <li class="dsm-my-expr-lib-folder">
                <div class="dsm-my-expr-lib-multi-item-inner">
                  <div
                    class="dsm-my-expr-lib-item-header"
                    onClick={() => {
                      // expand/contract folder
                      this.props
                        .plugin()
                        .toggleFolderExpanded(this.props.graph().link, expr.id);
                    }}
                  >
                    <i
                      class="dcg-icon-caret-down"
                      style={() => ({
                        transform: this.props
                          .plugin()
                          .isFolderExpanded(this.props.graph().link, expr.id)
                          ? ""
                          : "rotate(-90deg)",
                        display: "inline-block",
                      })}
                    />
                    <i class="dcg-icon-new-folder"></i>
                    <div class="dsm-my-expr-lib-item-title">{expr.text}</div>
                    <button
                      class="dsm-my-expr-lib-btn align-right dsm-my-expr-lib-rescale-plus"
                      onClick={(e: MouseEvent) => {
                        void this.props.plugin().loadFolder(expr);
                        e.stopPropagation();
                      }}
                    >
                      <i class="dcg-icon-plus"></i>
                    </button>
                  </div>
                  <If
                    predicate={() =>
                      this.props
                        .plugin()
                        .isFolderExpanded(this.props.graph().link, expr.id)
                    }
                  >
                    {() => {
                      const expressions = () =>
                        [...expr.expressions]
                          .map((e) => this.props.graph().expressions.get(e))
                          .filter((e) => e) as ExpressionLibraryExpression[];
                      return (
                        <Switch key={() => expressions().length}>
                          {() => {
                            if (expressions().length === 0) {
                              return (
                                <div>
                                  {format(
                                    "my-expressions-library-this-folder-is-empty"
                                  )}
                                </div>
                              );
                            }
                            return (
                              <div>
                                <For
                                  each={() => expressions()}
                                  key={(e) => e.uniqueID}
                                >
                                  <ol>
                                    {(e: ExpressionLibraryExpression) => (
                                      <LibrarySearchElement
                                        plugin={this.props.plugin}
                                        expr={() => e}
                                        graph={this.props.graph}
                                        observer={this.props.observer}
                                      ></LibrarySearchElement>
                                    )}
                                  </ol>
                                </For>
                              </div>
                            );
                          }}
                        </Switch>
                      );
                    }}
                  </If>
                </div>{" "}
              </li>
            );

            // math expression in the myexprlib menu
          } else if (expr.type === "expression") {
            const container = (
              <li
                class="dsm-my-expr-lib-math"
                onClick={(_: MouseEvent) => {
                  void this.props.plugin().loadMathExpression(expr);
                }}
                style={{
                  "min-height": "20px",
                  "overflow-x": "hidden",
                }}
              ></li>
            );
            expressionLibraryMathExpressionView(
              expr,
              this.props.observer(),
              container
            );
            return container;
          }
        }}
      </Switch>
    );
  }
}

class LibrarySearchGraph extends Component<{
  plugin: () => MyExpressionsLibrary;
  graph: () => LazyLoadableGraph;
  observer: () => IntersectionObserver;
}> {
  template() {
    const graph = () => this.props.graph();
    return (
      <li class="dsm-my-expr-lib-graph">
        <div class="dsm-my-expr-lib-multi-item-inner">
          <div
            class="dsm-my-expr-lib-item-header"
            onClick={() => {
              // toggle graph expanded/closed
              if (!this.props.plugin().isGraphExpanded(graph().link)) {
                void graph()
                  .load()
                  .then(() => {
                    this.props.plugin().updateViews();
                  });
              }
              this.props.plugin().toggleGraphExpanded(graph().link);
            }}
          >
            <i
              class="dcg-icon-caret-down"
              style={() => ({
                transform: this.props.plugin().isGraphExpanded(graph().link)
                  ? ""
                  : "rotate(-90deg)",
                display: "inline-block",
              })}
            />

            {IfElse(() => graph().valid !== GraphValidity.Invalid, {
              true: () => <i class="dcg-icon-cartesian"></i>,
              false: () => <i class="dcg-icon-error"></i>,
            })}

            <div class="dsm-my-expr-lib-item-title">
              {() =>
                graph().valid !== GraphValidity.Invalid
                  ? graph().name
                  : format("my-expressions-library-invalid-graph")
              }
            </div>

            <div class="align-right dsm-my-expr-lib-btn-container">
              <If predicate={() => graph().valid !== GraphValidity.Invalid}>
                {() => (
                  <button
                    class="dsm-my-expr-lib-btn dsm-my-expr-lib-rescale-plus"
                    onClick={async (e: MouseEvent) => {
                      const graphData = await graph().load();
                      if (!graphData) return;
                      void this.props.plugin().loadEntireGraph(graphData);
                      e.stopPropagation();
                    }}
                  >
                    <i class="dcg-icon-plus"></i>
                  </button>
                )}
              </If>

              <button
                class="dsm-my-expr-lib-btn"
                onClick={() => {
                  this.props.plugin().dsm.setPluginSetting(
                    "my-expressions-library",
                    "libraryGraphLinks",
                    this.props
                      .plugin()
                      .settings.libraryGraphLinks.filter(
                        (l) => l !== graph().link
                      )
                  );

                  this.props.plugin().cc._showToast({
                    message: format(
                      "my-expressions-library-remove-graph-success",
                      {
                        link: graph().link,
                        name: graph().name ?? "Untitled Graph",
                      }
                    ),
                  });
                }}
              >
                <i class="dcg-icon-remove"></i>
              </button>
            </div>
          </div>
          <If
            predicate={() => this.props.plugin().isGraphExpanded(graph().link)}
          >
            {() => (
              <Switch key={() => graph().loading || !graph().data}>
                {() => {
                  // when the graph is invalid, show a message saying that the
                  // graph at the given link failed to load when it's expanded
                  if (graph().valid === GraphValidity.Invalid) {
                    return (
                      <div>
                        {format(
                          "my-expressions-library-invalid-graph-details",
                          {
                            link: graph().link,
                          }
                        )}
                      </div>
                    );
                  }

                  // show a loading message while expanded while the graph is loading
                  if (graph().loading || !graph().data)
                    return (
                      <div>{format("my-expressions-library-loading")}</div>
                    );

                  // show the actual contents of the graph if it is loaded
                  return (
                    <div>
                      <For
                        each={() => {
                          return [...graph().data!.expressions.values()].filter(
                            (e) =>
                              e.type === "folder" ||
                              (e.type === "expression" &&
                                !(e.raw as ExpressionState).folderId)
                          );
                        }}
                        key={(e) => e.uniqueID}
                      >
                        <ol>
                          {(
                            e:
                              | ExpressionLibraryMathExpression
                              | ExpressionLibraryFolder
                          ) => (
                            <LibrarySearchElement
                              plugin={this.props.plugin}
                              expr={() => e}
                              graph={() => this.props.graph().data!}
                              observer={this.props.observer}
                            ></LibrarySearchElement>
                          )}
                        </ol>
                      </For>
                    </div>
                  );
                }}
              </Switch>
            )}
          </If>
        </div>
      </li>
    );
  }
}

export class LibrarySearchView extends Component<{
  plugin: () => MyExpressionsLibrary;
}> {
  template() {
    const observer = new IntersectionObserver(
      (evt) => {
        for (const entry of evt) {
          if (entry.isIntersecting) {
            // @ts-expect-error convenient way of passing handler into intersectionobserver
            entry.target._onEnterView?.();
          }
        }
      },
      { threshold: 0.5 }
    );

    let graphlink = "";

    return (
      <div class="dcg-popover-interior dsm-my-expr-lib-popup">
        <div class="dsm-my-expr-lib-menu">
          <div class="dsm-my-expr-lib-main-header" role="heading">
            {format("my-expressions-library-pillbox-menu")}
            <br></br>
            <input
              onClick={(evt: MouseEvent) => {
                if (evt.target instanceof HTMLElement) evt.target.focus();
              }}
              onInput={(e: InputEvent & { target: HTMLInputElement }) => {
                this.props.plugin().refineSearch(e.target.value);
              }}
              value={() => this.props.plugin().searchStr}
              placeholder={format("my-expressions-library-search")}
            ></input>
            <br></br>
            <input
              onInput={(e: InputEvent & { target: HTMLInputElement }) => {
                graphlink = e.target.value;
              }}
              onUpdate={(e: HTMLInputElement) => {
                e.value = graphlink;
              }}
              value={() => graphlink}
              placeholder={format("my-expressions-library-graph-link-here")}
            ></input>
            <button
              onClick={() => {
                this.props.plugin().dsm.setPluginSetting(
                  "my-expressions-library",
                  "libraryGraphLinks",
                  // this Array.from(new Set) stuff is to deduplicate
                  Array.from(
                    new Set([
                      ...this.props.plugin().settings.libraryGraphLinks,
                      graphlink,
                    ])
                  )
                );
                this.props.plugin().cc._showToast({
                  message: format("my-expressions-library-add-graph-success", {
                    link: graphlink,
                  }),
                });
                graphlink = "";
                this.props.plugin().updateViews();
              }}
            >
              {format("my-expressions-library-add-graph")}
            </button>
          </div>
          <Switch key={() => this.props.plugin().searchStr}>
            {() => {
              // if search string is empty, display everything normally
              // with collapsible sections for graphs/folders etc
              if (this.props.plugin().searchStr === "") {
                return (
                  <For
                    each={() => {
                      return [...this.props.plugin().graphs.values()];
                    }}
                    key={(g) => g.id}
                  >
                    <ul>
                      {(g: LazyLoadableGraph) => {
                        return (
                          <LibrarySearchGraph
                            graph={() => g}
                            plugin={this.props.plugin}
                            observer={() => observer}
                          ></LibrarySearchGraph>
                        );
                      }}
                    </ul>
                  </For>
                );
              }

              // if there is a search string,
              // just show all the expressions that match
              return (
                <For
                  each={() => {
                    return this.props
                      .plugin()
                      .getLibraryExpressions()
                      .filter((e) => e.type === "expression");
                  }}
                  key={(e) => e.uniqueID}
                >
                  <ul>
                    {(e: ExpressionLibraryMathExpression) => {
                      return (
                        <LibrarySearchElement
                          graph={() => e.graph}
                          expr={() => e}
                          plugin={this.props.plugin}
                          observer={() => observer}
                        ></LibrarySearchElement>
                      );
                    }}
                  </ul>
                </For>
              );
            }}
          </Switch>
        </div>
      </div>
    );
  }
}
