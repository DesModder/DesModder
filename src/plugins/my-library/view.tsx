import { MyLibrary } from ".";
import {
  ExpressionLibraryExpression,
  ExpressionLibraryFolder,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
} from "./library-statements";
import "./index.less";
import { Component, jsx, mountToNode } from "#DCGView";
import { For, If, IfElse, StaticMathQuillView, Switch } from "#components";
import { format } from "#i18n";
import { ExpressionState } from "../../../graph-state";
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

function folderView(
  container: LibrarySearchElement,
  expr: ExpressionLibraryFolder
) {
  return (
    <li class="dsm-my-expr-lib-folder">
      <div class="dsm-my-expr-lib-multi-item-inner">
        <div
          class="dsm-my-expr-lib-item-header"
          onTap={() => {
            container.props.ml().cc.dispatch({
              type: "dsm-my-library-toggle-folder-expanded",
              link: container.props.graph().link,
              id: expr.id,
            });
          }}
        >
          <i
            class="dcg-icon-caret-down"
            style={() => ({
              transform: container.props
                .ml()
                .isFolderExpanded(container.props.graph().link, expr.id)
                ? ""
                : "rotate(-90deg)",
              display: "inline-block",
            })}
          />
          <i class="dcg-icon-new-folder"></i>
          <div class="dsm-my-expr-lib-item-title">{expr.text}</div>
          <button
            class="dsm-my-expr-lib-btn align-right dsm-my-expr-lib-rescale-plus"
            onTap={() => {
              container.props.ml().cc.dispatch({
                type: "dsm-my-library-insert-folder",
                expr,
              });
            }}
          >
            <i class="dcg-icon-plus"></i>
          </button>
        </div>
        <If
          predicate={() =>
            container.props
              .ml()
              .isFolderExpanded(container.props.graph().link, expr.id)
          }
        >
          {() => {
            const expressions = () =>
              [...expr.expressions]
                .map((e) => container.props.graph().expressions.get(e))
                .filter((e) => e) as ExpressionLibraryExpression[];
            return (
              <Switch key={() => expressions().length}>
                {() => {
                  // show message indicating that a folder is empty
                  // (and not just, say, loading (even though that makes no sense))
                  if (expressions().length === 0) {
                    return (
                      <div>{format("my-library-this-folder-is-empty")}</div>
                    );
                  }

                  // show contents of folder
                  return (
                    <div>
                      <ol>
                        <For each={() => expressions()} key={(e) => e.uniqueID}>
                          {(e: ExpressionLibraryExpression) => (
                            <LibrarySearchElement
                              ml={container.props.ml}
                              expr={() => e}
                              graph={container.props.graph}
                              observer={container.props.observer}
                            ></LibrarySearchElement>
                          )}
                        </For>
                      </ol>
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
}

class LibrarySearchElement extends Component<{
  ml: () => MyLibrary;
  expr: () => ExpressionLibraryMathExpression | ExpressionLibraryFolder;
  graph: () => ExpressionLibraryGraph;
  observer: () => IntersectionObserver;
}> {
  ml!: MyLibrary;
  init() {
    this.ml = this.props.ml();
  }

  template() {
    return (
      <Switch key={() => this.props.expr().type}>
        {() => {
          const expr = this.props.expr();

          // folder expression in the myexprlib menu
          if (expr.type === "folder") {
            return folderView(this, expr);

            // math expression in the myexprlib menu
          } else if (expr.type === "expression") {
            const container = (
              <li
                class="dsm-my-expr-lib-math"
                onTap={() => {
                  this.ml.cc.dispatch({
                    type: "dsm-my-library-insert-math",
                    expr,
                  });
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
  ml: () => MyLibrary;
  graph: () => LazyLoadableGraph;
  observer: () => IntersectionObserver;
}> {
  ml!: MyLibrary;
  init() {
    this.ml = this.props.ml();
  }

  template() {
    const graph = () => this.props.graph();
    return (
      <li class="dsm-my-expr-lib-graph">
        <div class="dsm-my-expr-lib-multi-item-inner">
          <div
            class="dsm-my-expr-lib-item-header"
            onTap={() => {
              this.ml.cc.dispatch({
                type: "dsm-my-library-toggle-graph-expanded",
                link: graph().link,
              });
            }}
          >
            <i
              class="dcg-icon-caret-down"
              style={() => ({
                transform: this.ml.isGraphExpanded(graph().link)
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
                  : format("my-library-invalid-graph")
              }
            </div>

            <div class="align-right dsm-my-expr-lib-btn-container">
              <If predicate={() => graph().valid !== GraphValidity.Invalid}>
                {() => (
                  <button
                    class="dsm-my-expr-lib-btn dsm-my-expr-lib-rescale-plus"
                    onTap={() => {
                      this.ml.cc.dispatch({
                        type: "dsm-my-expr-lib-insert-entire-graph",
                        link: graph().link,
                      });
                    }}
                  >
                    <i class="dcg-icon-plus"></i>
                  </button>
                )}
              </If>

              <button
                class="dsm-my-expr-lib-btn"
                onTap={() => {
                  this.ml.cc.dispatch({
                    type: "dsm-my-library-remove-graph",
                    link: graph().link,
                  });
                }}
              >
                <i class="dcg-icon-remove"></i>
              </button>
            </div>
          </div>
          <If predicate={() => this.ml.isGraphExpanded(graph().link)}>
            {() => (
              <Switch key={() => graph().loading || !graph().data}>
                {() => {
                  // when the graph is invalid, show a message saying that the
                  // graph at the given link failed to load when it's expanded
                  if (graph().valid === GraphValidity.Invalid) {
                    return (
                      <div>
                        {format("my-library-invalid-graph-details", {
                          link: graph().link,
                        })}
                      </div>
                    );
                  }

                  // show a loading message while expanded while the graph is loading
                  if (graph().loading || !graph().data)
                    return <div>{format("my-library-loading")}</div>;

                  // show the actual contents of the graph if it is loaded
                  return (
                    <div>
                      <ol>
                        <For
                          each={() => {
                            return [
                              ...graph().data!.expressions.values(),
                            ].filter(
                              (e) =>
                                e.type === "folder" ||
                                (e.type === "expression" &&
                                  !(e.raw as ExpressionState).folderId)
                            );
                          }}
                          key={(e) => e.uniqueID}
                        >
                          {(
                            e:
                              | ExpressionLibraryMathExpression
                              | ExpressionLibraryFolder
                          ) => (
                            <LibrarySearchElement
                              ml={this.props.ml}
                              expr={() => e}
                              graph={() => this.props.graph().data!}
                              observer={this.props.observer}
                            ></LibrarySearchElement>
                          )}
                        </For>
                      </ol>
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

class LibrarySearchView extends Component<{
  ml: () => MyLibrary;
}> {
  ml!: MyLibrary;
  init() {
    this.ml = this.props.ml();
  }

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
      <div class="dcg-popover-interior dsm-my-expr-lib-popup">
        <div class="dsm-my-expr-lib-menu">
          <div class="dsm-my-expr-lib-main-header" role="heading">
            {format("my-library-pillbox-menu")}
            <br></br>
            <input
              onClick={(evt: MouseEvent) => {
                // TODO-ml: why does there need to be special handling to focus the input?
                if (evt.target instanceof HTMLElement) evt.target.focus();
              }}
              onInput={(e: InputEvent & { target: HTMLInputElement }) => {
                this.ml.refineSearch(e.target.value);
              }}
              value={() => this.ml.searchStr}
              placeholder={format("my-library-search")}
            />
            <br></br>
            <input
              onInput={(e: InputEvent & { target: HTMLInputElement }) => {
                this.ml.graphLink = e.target.value;
              }}
              value={() => this.ml.graphLink}
              placeholder={format("my-library-graph-link-here")}
            ></input>
            <button
              onTap={() => {
                this.ml.cc.dispatch({
                  type: "dsm-my-library-add-graph",
                  link: this.ml.graphLink,
                });
              }}
            >
              {format("my-library-add-graph")}
            </button>
          </div>
          <Switch key={() => this.ml.searchStr}>
            {() => {
              // if search string is empty, display everything normally
              // with collapsible sections for graphs/folders etc
              if (this.ml.searchStr === "") {
                return (
                  <ul>
                    <For
                      each={() => {
                        return [...this.ml.graphs.values()];
                      }}
                      key={(g) => g.id}
                    >
                      {(g: LazyLoadableGraph) => {
                        return (
                          <LibrarySearchGraph
                            graph={() => g}
                            ml={this.props.ml}
                            observer={() => observer}
                          ></LibrarySearchGraph>
                        );
                      }}
                    </For>
                  </ul>
                );
              }

              // if there is a search string,
              // just show all the expressions that match
              return (
                <ul>
                  <For
                    each={() => {
                      return this.props
                        .ml()
                        .getLibraryExpressions()
                        .filter((e) => e.type === "expression");
                    }}
                    key={(e) => e.uniqueID}
                  >
                    {(e: ExpressionLibraryMathExpression) => {
                      return (
                        <LibrarySearchElement
                          graph={() => e.graph}
                          expr={() => e}
                          ml={this.props.ml}
                          observer={() => observer}
                        ></LibrarySearchElement>
                      );
                    }}
                  </For>
                </ul>
              );
            }}
          </Switch>
        </div>
      </div>
    );
  }
}

export function LibrarySearchViewFunc(ml: MyLibrary): LibrarySearchView {
  return <LibrarySearchView ml={() => ml} />;
}
