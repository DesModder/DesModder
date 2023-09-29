import { Component, jsx, mountToNode } from "#DCGView";
import { autoOperatorNames } from "src/utils/depUtils";
import { Inserter, PluginController } from "../PluginController";
import "./index.less";
import { format } from "localization/i18n-core";
import {
  DStaticMathquillView,
  If,
  IfElse,
  InlineMathInputView,
  MathQuillView,
  MathQuillViewComponent,
  StaticMathQuillView,
} from "src/components";
import { Calc, ExpressionModel, FolderModel, Fragile } from "src/globals";

function calcWidthInPixels(domNode?: HTMLElement) {
  const rootblock = domNode?.querySelector(".dcg-mq-root-block");

  if (!rootblock?.lastChild || !rootblock.firstChild) return 0;

  const range = document.createRange();
  range.setStartBefore(rootblock.firstChild);
  range.setEndAfter(rootblock.lastChild);

  const width = range.getBoundingClientRect().width;

  return width;
}

function symbolCount(el: Element) {
  const svgLen = [".dcg-mq-fraction", "svg", ".dcg-mq-token"]
    .map((s) => el.querySelectorAll(s).length)
    .reduce((a, b) => a + b);
  return (
    svgLen +
    (el.textContent?.replace(
      /\s|[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,
      ""
    )?.length ?? 0)
  );
}

function calcSymbolCount(el?: HTMLElement) {
  const rootblock = el?.querySelector(".dcg-mq-root-block");
  if (!rootblock) return 0;

  return rootblock ? symbolCount(rootblock) : 0;
}

function getGolfStats(latex: string) {
  const fakeContainer = document.createElement("div");
  document.body.appendChild(fakeContainer);
  fakeContainer.style.transform = `scale(${1 / 0.75})`;

  mountToNode(InlineMathInputView, fakeContainer, {
    latex: () => latex ?? "",
    isFocused: () => false,
    selectOnFocus: () => false,
    handleLatexChanged: () => {},
    hasError: () => false,
    handleFocusChanged: () => () => false,
    ariaLabel: () => "",
    // getAriaLabel: () => "",
    // getAriaPostLabel: () => "",
    // capExpressionSize: () => false as false,
    // onUserChangedLatex: () => {},
    // config: () => ({ autoOperatorNames: "" }),
  });

  const stats = {
    width: calcWidthInPixels(fakeContainer),
    symbols: calcSymbolCount(fakeContainer),
  };

  document.body.removeChild(fakeContainer);

  return stats;
}

export class ExpressionItemCostPanel extends Component<{
  model: () => ExpressionModel;
  el: () => HTMLDivElement;
}> {
  rootblock: Element | null | undefined = null;

  template() {
    const chars = () => this.props.model().latex?.length ?? 0;

    return IfElse(() => chars() > 0, {
      true: () => (
        <div class="dsm-code-golf-char-count-container">
          <div class="dsm-code-golf-char-count">
            <div>
              {() => {
                return format("code-golf-width-in-pixels", {
                  pixels: Math.round(
                    getGolfStats(this.props.model().latex ?? "").width
                  ).toString(),
                });
              }}
            </div>
            <div>
              {() => {
                return format("code-golf-symbol-count", {
                  elements: getGolfStats(this.props.model().latex ?? "")
                    .symbols,
                });
              }}
            </div>
          </div>
        </div>
      ),
      false: () => <div></div>,
    });
  }
}
export class FolderCostPanel extends Component<{
  model: () => FolderModel;
}> {
  totalWidth = 0;
  totalSymbols = 0;

  template() {
    console.log("this", this);

    Calc.controller.dispatcher.register((e) => {
      console.log("forceupadte");

      const exprs = Calc.controller
        .getAllItemModels()
        .filter(
          (m) => m.type === "expression" && m.folderId === this.props.model().id
        ) as ExpressionModel[];

      this.totalWidth = 0;
      this.totalSymbols = 0;

      for (const e of exprs) {
        const { width, symbols } = getGolfStats(e.latex ?? "");
        this.totalWidth += width;
        this.totalSymbols += symbols;
      }

      this.update();
    });

    return (
      <div class="dsm-code-golf-char-count-container">
        <div class="dsm-code-golf-char-count">
          <div>
            {() =>
              format("code-golf-width-in-pixels", {
                pixels: Math.round(this.totalWidth),
              })
            }
          </div>
          <div>
            {() =>
              format("code-golf-symbol-count", {
                elements: this.totalSymbols,
              })
            }
          </div>
        </div>
      </div>
    );
  }
}

export default class CodeGolf extends PluginController {
  static id = "code-golf" as const;
  static enabledByDefault = false;

  expressionItemCostPanel(
    model: ExpressionModel,
    el: HTMLDivElement
  ): Inserter {
    return () => <ExpressionItemCostPanel model={() => model} el={() => el} />;
  }

  folderCostPanel(model: FolderModel) {
    return () => <FolderCostPanel model={() => model}></FolderCostPanel>;
  }

  afterConfigChange(): void {}

  afterEnable() {}

  afterDisable() {}
}
