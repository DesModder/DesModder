import MyExpressionsLibrary, { ExpressionLibraryExpression } from ".";
import "./library-search.less";
import { ExpressionState } from "@desmodder/graph-state";
import { Component, jsx, mountToNode } from "DCGView";
import { DStaticMathquillView, For } from "components";
import StaticMathquillView from "components/StaticMathQuillView";

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
        <div class="dsm-library-search">
          <div class="libsearch-header" role="heading">
            My Expressions Library
            <br></br>
            <input
              onClick={(evt: MouseEvent) => {
                if (evt.target instanceof HTMLElement) evt.target.focus();
              }}
              onInput={(e: InputEvent & { target: HTMLInputElement }) => {
                this.props.plugin().refineSearch(e.target.value);
              }}
              value={() => this.props.plugin().searchStr}
            ></input>
          </div>
          <For
            each={() => this.props.plugin().getLibraryExpressions()}
            key={(expr) => expr.uniqueID}
          >
            <ul class="dsm-library-search-exprlist">
              {(expr: ExpressionLibraryExpression) => {
                const container = (
                  <li
                    onClick={(e: MouseEvent) => {
                      console.log("loading expr..");
                      void this.props.plugin().loadExpression(expr);
                      // e.stopPropagation();
                      // e.preventDefault();
                    }}
                    style={{ "min-height": "20px", "overflow-x": "hidden" }}
                  ></li>
                );

                // has to happen in a timeout since dom nodes aren't created immediately
                setTimeout(() => {
                  const domNode = container._domNode as HTMLDivElement;
                  // @ts-expect-error convenient way of passing handler into intersectionobserver
                  domNode._onEnterView = () => {
                    mountToNode(StaticMathquillView, domNode, {
                      latex: () => expr.latex?.slice(0, 1000) ?? "",
                    });
                    observer.unobserve(domNode);
                  };

                  observer.observe(domNode);
                }, 0);
                return container;
              }}
            </ul>
          </For>
        </div>
      </div>
    );
  }
}
