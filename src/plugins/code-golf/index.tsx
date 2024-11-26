import { Component, jsx, mountToNode } from "#DCGView";
import { Inserter, PluginController } from "../PluginController";
import "./index.less";
import { format } from "localization/i18n-core";
import { IfElse, InlineMathInputView } from "src/components";
import { CalcController, ExpressionModel, FolderModel } from "src/globals";

function calcWidthInPixels(domNode?: HTMLElement) {
  const rootblock = domNode?.querySelector(".dcg-mq-root-block");

  if (!rootblock?.lastChild || !rootblock.firstChild) return 0;

  const range = document.createRange();
  range.setStartBefore(rootblock.firstChild);
  range.setEndAfter(rootblock.lastChild);

  const { width } = range.getBoundingClientRect();

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

const cachedGolfStatsPool = new Map<string, ReturnType<typeof getGolfStats>>();

function getGolfStats(
  cc: CalcController,
  latex: string
): {
  width: number;
  symbols: number;
} {
  const cached = cachedGolfStatsPool.get(latex);
  if (cached) return cached;

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
    controller: () => cc,
  });

  const stats = {
    width: calcWidthInPixels(fakeContainer),
    symbols: calcSymbolCount(fakeContainer),
  };

  cachedGolfStatsPool.set(latex, stats);

  if (cachedGolfStatsPool.size > 10000) {
    cachedGolfStatsPool.delete(cachedGolfStatsPool.keys().next().value);
  }

  document.body.removeChild(fakeContainer);

  return stats;
}

export class ExpressionItemCostPanel extends Component<{
  cc: () => CalcController;
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
              {() =>
                format("code-golf-width-in-pixels", {
                  pixels: Math.round(
                    getGolfStats(
                      this.props.cc(),
                      this.props.model().latex ?? ""
                    ).width
                  ).toString(),
                })
              }
            </div>
            <div>
              {() =>
                format("code-golf-symbol-count", {
                  elements: getGolfStats(
                    this.props.cc(),
                    this.props.model().latex ?? ""
                  ).symbols,
                })
              }
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
  cc: () => CalcController;
}> {
  totalWidth = 0;
  totalSymbols = 0;

  enabled = true;
  checkedStats = false;

  get cc() {
    return this.props.cc();
  }

  recalculate() {
    const exprs = this.props
      .cc()
      .getAllItemModels()
      .filter(
        (m) => m.type === "expression" && m.folderId === this.props.model().id
      ) as ExpressionModel[];

    this.totalWidth = 0;
    this.totalSymbols = 0;

    if (!this.checkedStats) {
      const chars = exprs.reduce(
        (prev, curr) => prev + (curr.latex?.length ?? 0),
        0
      );

      if (chars > 2000) {
        this.enabled = false;
        this.checkedStats = true;
        this.update();
        return;
      }
    }

    for (const e of exprs) {
      const { width, symbols } = getGolfStats(this.cc, e.latex ?? "");
      this.totalWidth += width;
      this.totalSymbols += symbols;
    }

    this.update();
  }

  dispatcher!: string;

  willUnmount() {
    this.cc.dispatcher.unregister(this.dispatcher);
  }

  template() {
    setTimeout(() => {
      this.recalculate();
    }, 0);

    this.dispatcher = this.cc.dispatcher.register(() => {
      this.recalculate();
    });

    return (
      <div
        class="dsm-code-golf-char-count-container"
        onClick={() => {
          this.enabled = true;
          this.recalculate();
        }}
      >
        {IfElse(() => this.enabled, {
          true: () => (
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
          ),
          false: () => (
            <div class="dsm-code-golf-char-count dsm-clickable">
              {format("code-golf-click-to-enable-folder")}
            </div>
          ),
        })}
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
    return () => (
      <ExpressionItemCostPanel
        cc={() => this.cc}
        model={() => model}
        el={() => el}
      />
    );
  }

  folderCostPanel(model: FolderModel) {
    return () => (
      <FolderCostPanel cc={() => this.cc} model={() => model}></FolderCostPanel>
    );
  }

  afterConfigChange(): void {}

  dispatcher!: string;

  afterEnable() {}

  afterDisable() {}
}
