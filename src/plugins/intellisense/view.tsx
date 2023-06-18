import { ExpressionBoundIdentifier, getMQCursorPosition } from ".";
import "./view.less";
import { ClassComponent, Component, DCGView, jsx } from "DCGView";
import { For, MathQuillView, StaticMathQuillView, Switch } from "components";

export function addBracketsToIdent(str: string) {
  if (str.length === 1) return str;

  return str[0] + "_{" + str.slice(2) + "}";
}

export class IdentifierSymbol extends Component<{
  symbol: () => ExpressionBoundIdentifier["type"];
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

export class View extends Component<{
  x: () => number;
  y: () => number;
  idents: () => ExpressionBoundIdentifier[];
  autocomplete: (option: ExpressionBoundIdentifier) => void;
  index: () => number;
}> {
  init() {}

  template() {
    let div: HTMLDivElement;

    return (
      <div
        id="intellisense-container"
        style={() => ({
          top: (this.props.y() + 30).toString() + "px",
          left: this.props.x().toString() + "px",
          display: this.props.idents().length > 0 ? "block" : "none",
          transform:
            this.props.y() > window.innerHeight / 2
              ? `translateY(calc(-100% - 50px))`
              : "",
        })}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
        }}
      >
        <For
          each={() =>
            this.props.idents().map((ident, index) => ({ ...ident, index }))
          }
          key={(e) => e.id}
        >
          <table class="intellisense-options-table">
            {(ident: ExpressionBoundIdentifier & { index: number }) => {
              const reformattedIdent = addBracketsToIdent(ident.variableName);

              const isSelected = () => ident.index === this.props.index();

              console.log(ident.variableName);

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
                  onClick={(e: MouseEvent) => {
                    this.props.autocomplete(ident);
                  }}
                >
                  <td>
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
