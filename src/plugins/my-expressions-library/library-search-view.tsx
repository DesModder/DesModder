import MyExpressionsLibrary, {
  ExpressionLibraryExpression,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
  ExpressionsLibraryGraphs,
} from ".";
import "./library-search.less";
import { Component, jsx, mountToNode } from "#DCGView";
import { For, StaticMathQuillView, Switch } from "#components";
import { format } from "#i18n";

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
                    void this.props.plugin().loadEntireGraph(expr);
                  }}
                >
                  <i class="dcg-icon-cartesian"></i>
                  {expr.title}
                </div>

                <For
                  each={() => [...expr.expressions.entries()]}
                  key={(e) => e[0]}
                >
                  <ol>
                    {(e: [string, ExpressionLibraryExpression]) => (
                      <LibrarySearchElement
                        plugin={this.props.plugin}
                        expr={() => e[1]}
                        graph={this.props.graph}
                        observer={this.props.observer}
                      ></LibrarySearchElement>
                    )}
                  </ol>
                </For>
              </li>
            );
          } else if (expr.type === "folder") {
            return (
              <li class="dsm-library-search-folder">
                <div
                  class="dsm-library-search-folder-header"
                  onClick={() => {
                    void this.props.plugin().loadFolder(expr);
                  }}
                >
                  <i class="dcg-icon-new-folder"></i>
                  {expr.text}
                </div>
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
