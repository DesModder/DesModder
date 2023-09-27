import { Component, jsx } from "#DCGView";
import { Inserter, PluginController } from "../PluginController";
import "./index.less";
import { format } from "localization/i18n-core";
import { IfElse } from "src/components";
import { ExpressionModel } from "src/globals";

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
                const tempRootblock = this.props
                  .model()
                  .dcgView?._element._domNode?.querySelector(
                    ".dcg-main .dcg-mq-root-block"
                  );

                if (tempRootblock) this.rootblock = tempRootblock;

                if (!this.rootblock) return "0px";

                if (!this.rootblock.lastChild || !this.rootblock.firstChild)
                  return "0px";

                const range = document.createRange();
                range.setStartBefore(this.rootblock.firstChild);
                range.setEndAfter(this.rootblock.lastChild);

                const width = range.getBoundingClientRect().width;

                return format("code-golf-width-in-pixels", {
                  pixels: Math.round(width).toString(),
                });
              }}
            </div>
            <div>
              {() => {
                const el = this.props.model().dcgView?._element._domNode;

                const tempRootblock = el?.querySelector(
                  ".dcg-main .dcg-mq-root-block"
                );
                if (tempRootblock) this.rootblock = tempRootblock;

                function symbolCount2(el: Element) {
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

                return format("code-golf-symbol-count", {
                  elements: this.rootblock ? symbolCount2(this.rootblock) : 0,
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

export default class CodeGolf extends PluginController {
  static id = "code-golf" as const;
  static enabledByDefault = false;

  expressionItemCostPanel(
    model: ExpressionModel,
    el: HTMLDivElement
  ): Inserter {
    return () => (
      <ExpressionItemCostPanel
        model={() => model}
        el={() => el}
      ></ExpressionItemCostPanel>
    );
  }

  afterConfigChange(): void {}

  afterEnable() {}

  afterDisable() {}
}
