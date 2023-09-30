import { Component, jsx, mountToNode } from "#DCGView";
import { GraphState } from "@desmodder/graph-state";
import { Inserter, PluginController } from "../PluginController";
import "./index.less";
import { format } from "localization/i18n-core";
import { IfElse, InlineMathInputView } from "src/components";
import {
  Calc,
  ExpressionModel,
  FolderModel,
  ItemModel,
  TextModel,
} from "src/globals";

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

const cachedGolfStatsPool = new Map<string, ReturnType<typeof getGolfStats>>();

function getGolfStats(latex: string): {
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

  enabled = true;
  checkedStats = false;

  recalculate() {
    const exprs = Calc.controller
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
      const { width, symbols } = getGolfStats(e.latex ?? "");
      this.totalWidth += width;
      this.totalSymbols += symbols;
    }

    this.update();
  }

  dispatcher!: string;

  willUnmount() {
    Calc.controller.dispatcher.unregister(this.dispatcher);
  }

  template() {
    setTimeout(() => {
      this.recalculate();
    }, 0);

    this.dispatcher = Calc.controller.dispatcher.register(() => {
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

function extractCodegolfedTextString(text: string): string | undefined {
  if (!text.startsWith("@codegolf")) return undefined;

  return text.slice(text.match(/@codegolf\s*/g)?.[0]?.length ?? 0);
}

export class NoteCostPanel extends Component<{
  model: () => TextModel;
}> {
  template() {
    console.log(this.props.model());

    return (
      <div class="dsm-code-golf-char-count-container">
        {IfElse(
          () => this.props.model().text?.startsWith("@codegolf") ?? false,
          {
            true: () => (
              <div class="dsm-code-golf-char-count">
                {() =>
                  format("code-golf-note-latex-byte-count", {
                    chars:
                      (new Blob([this.props.model().text ?? ""])?.size ?? 0) -
                      (new Blob([
                        this.props.model().text?.match(/@codegolf\s*/g)?.[0] ??
                          "",
                      ]).size ?? 0),
                  })
                }
              </div>
            ),
            false: () => <div></div>,
          }
        )}
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

  noteCostPanel(model: TextModel) {
    return () => <NoteCostPanel model={() => model}></NoteCostPanel>;
  }

  afterConfigChange(): void {}

  dispatcher!: string;

  prevNoteLatex = new Map<string, string>();

  afterEnable() {
    this.updateTextExprGolfMappings(Calc.getState());

    this.dispatcher = Calc.controller.dispatcher.register((e) => {
      if (e.type === "set-note-text") {
        const latex = extractCodegolfedTextString(e.text);

        if (!latex) return;

        const model = Calc.controller.getItemModel(e.id) as TextModel;

        const nextModel = Calc.controller.getItemModelByIndex(model.index + 1);

        setTimeout(() => {
          if (
            !nextModel ||
            nextModel.type !== "expression" ||
            this.prevNoteLatex.get(e.id) !== nextModel.latex
          ) {
            Calc.setExpression({
              type: "expression",
              latex,
            });

            const newExpr = Calc.controller.listModel.__itemModelArray.pop();

            Calc.controller.listModel.__itemModelArray.splice(
              model.index + 1,
              0,
              newExpr as (typeof Calc.controller.listModel.__itemModelArray)[0]
            );

            Calc.controller.updateTheComputedWorld();
          } else {
            Calc.controller.dispatch({
              type: "set-item-latex",
              latex,
              id: nextModel.id,
            });
          }
          this.prevNoteLatex.set(e.id, latex);
        });
      }

      if (e.type === "set-state") {
        this.updateTextExprGolfMappings(e.state);
      }
    });
  }

  updateTextExprGolfMappings(state: GraphState) {
    const list = state.expressions.list;
    for (let i = 0; i < list.length; i++) {
      const note = list[i];
      if (note.type === "text") {
        const latex = extractCodegolfedTextString(note.text ?? "");
        if (latex) {
          this.prevNoteLatex.set(note.id, latex);
        }
      }
    }
  }

  afterDisable() {
    Calc.controller.dispatcher.unregister(this.dispatcher);
  }
}
