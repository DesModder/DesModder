import MyExpressionsLibrary, {
  ExpressionLibraryExpression,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
  ExpressionsLibraryGraphs,
} from ".";
import "./library-search.less";
import { Component, jsx, mountToNode } from "#DCGView";
import { For, If, StaticMathQuillView, Switch } from "#components";
import { format } from "#i18n";
import { ExpressionState } from "@desmodder/graph-state";

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
  expr: () => ExpressionLibraryExpression;
  graph: () => ExpressionLibraryGraph;
  observer: () => IntersectionObserver;
}> {
  template() {
    return (
      <Switch key={() => this.props.expr().type}>
        {() => {
          const expr = this.props.expr();
          if (expr.type === "graph") {
            return (
              <li class="dsm-library-search-graph">
                <div
                  class="dsm-library-search-graph-header"
                  onClick={() => {
                    this.props.plugin().toggleGraphExpanded(expr.link);
                  }}
                >
                  <i
                    class="dcg-icon-caret-down"
                    style={() => ({
                      transform: this.props.plugin().isGraphExpanded(expr.link)
                        ? ""
                        : "rotate(-90deg)",
                      display: "inline-block",
                    })}
                  />
                  <i class="dcg-icon-cartesian"></i>
                  {expr.title}
                  <button
                    class="dsm-my-expr-lib-load-btn"
                    onClick={(e: MouseEvent) => {
                      void this.props.plugin().loadEntireGraph(expr);
                      e.stopPropagation();
                    }}
                  >
                    Load
                  </button>
                </div>
                <If
                  predicate={() =>
                    this.props.plugin().isGraphExpanded(expr.link)
                  }
                >
                  {() => (
                    <For
                      each={() =>
                        [...expr.expressions.values()].filter(
                          (e) =>
                            e.type === "folder" ||
                            (e.type === "expression" &&
                              !(e.raw as ExpressionState).folderId)
                        )
                      }
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
                  )}
                </If>
              </li>
            );
          } else if (expr.type === "folder") {
            return (
              <li class="dsm-library-search-folder">
                <div
                  class="dsm-library-search-folder-header"
                  onClick={() => {
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
                  {expr.text}
                  <button
                    class="dsm-my-expr-lib-load-btn"
                    onClick={(e: MouseEvent) => {
                      void this.props.plugin().loadFolder(expr);
                      e.stopPropagation();
                    }}
                  >
                    Load
                  </button>
                </div>
                <If
                  predicate={() =>
                    this.props
                      .plugin()
                      .isFolderExpanded(this.props.graph().link, expr.id)
                  }
                >
                  {() => (
                    <For
                      each={() =>
                        [...expr.expressions]
                          .map((e) => this.props.graph().expressions.get(e))
                          .filter((e) => e) as ExpressionLibraryExpression[]
                      }
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
                  )}
                </If>
              </li>
            );
          } else if (expr.type === "expression") {
            const container = (
              <li
                class="dsm-library-search-math"
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

    return (
      <div class="dcg-popover-interior">
        <Switch key={() => this.props.plugin().graphs?.graphs}>
          {() => {
            if (Array.isArray(this.props.plugin().graphs?.graphs)) {
              if (
                (this.props.plugin().graphs as ExpressionsLibraryGraphs).graphs
                  .length > 0
              ) {
                return (
                  <div class="dsm-library-search">
                    <div class="libsearch-header" role="heading">
                      {format("my-expressions-library-pillbox-menu")}
                      <br></br>
                      <input
                        onClick={(evt: MouseEvent) => {
                          if (evt.target instanceof HTMLElement)
                            evt.target.focus();
                        }}
                        onInput={(
                          e: InputEvent & { target: HTMLInputElement }
                        ) => {
                          this.props.plugin().refineSearch(e.target.value);
                        }}
                        value={() => this.props.plugin().searchStr}
                      ></input>
                    </div>
                    <Switch key={() => this.props.plugin().searchStr}>
                      {() => {
                        if (this.props.plugin().searchStr === "") {
                          return (
                            <For
                              each={() => {
                                return this.props.plugin().graphs?.graphs ?? [];
                              }}
                              key={(g) => g.uniqueID}
                            >
                              <ul>
                                {(g: ExpressionLibraryGraph) => {
                                  return (
                                    <LibrarySearchElement
                                      graph={() => g}
                                      expr={() => g}
                                      plugin={this.props.plugin}
                                      observer={() => observer}
                                    ></LibrarySearchElement>
                                  );
                                }}
                              </ul>
                            </For>
                          );
                        }
                        return (
                          <For
                            each={() => {
                              return this.props
                                .plugin()
                                .getLibraryExpressions()
                                .filter((e) => e.type === "expression")
                                .filter((e) => {
                                  const expr =
                                    e as ExpressionLibraryMathExpression;
                                  return expr.textMode.includes(
                                    this.props.plugin().searchStr
                                  );
                                });
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
                );
              } else {
                return (
                  <div>
                    <div class="libsearch-header" role="heading">
                      {format("my-expressions-library-pillbox-menu")}
                    </div>
                    {format("my-expressions-library-empty-library")}
                  </div>
                );
              }
            }
          }}
        </Switch>
      </div>
    );
  }
}
