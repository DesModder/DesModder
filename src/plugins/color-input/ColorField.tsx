import ColorInput from ".";
import { Component, jsx } from "#DCGView";
import { InlineMathInputView, MathQuillView } from "#components";
import { mathquillFocusHelper } from "../../globals";
import "./ColorField.less";

export default class ColorField extends Component<{ ci: ColorInput }> {
  ci!: ColorInput;

  handlePressedKey = (key: string, evt: KeyboardEvent) => {
    const mq = MathQuillView.getFocusedMathquill();
    mq?.keystroke(key, evt);
  };

  init() {
    this.ci = this.props.ci();
  }

  template() {
    return (
      <div class="dcg-iconed-mathquill-row dcg-line-opacity-row" style="min">
        <div
          class="dcg-tooltip-hit-area-container dcg-do-not-blur dcg-cursor-default"
          tabindex="-1"
          ontap=""
        >
          <i class="dcg-icon-palette" aria-hidden="true"></i>
        </div>
        <div class="dsm-color-input-container">
          <InlineMathInputView
            placeholder={() => this.getPlaceholder()}
            ariaLabel={""}
            handleLatexChanged={(latex) => this.setColorLatex(latex)}
            latex={() => this.getColorLatex()}
            hasError={() => this.hasError()}
            manageFocus={mathquillFocusHelper({
              controller: this.ci.cc,
              location: {
                type: "dsm-focus",
                plugin: "color-input",
                kind: "color-input-field",
              },
            })}
            controller={this.ci.cc}
            noFadeout={() => true}
            handlePressedKey={(key, e) => {
              this.handlePressedKey(key, e);
              const mq = MathQuillView.getFocusedMathquill();
              if (mq) this.setColorLatex(mq.latex());
            }}
          />
        </div>
      </div>
    );
  }

  setColorLatex(latex: string) {
    if (!this.ci.exprModel) return;
    this.ci.cc.dispatch({
      type: "set-item-colorlatex",
      id: this.ci.exprModel.id,
      colorLatex: latex,
    });
  }

  getColorLatex(): string {
    return this.ci.exprModel?.colorLatex ?? "";
  }

  hasError(): boolean {
    return !this.ci.exprModel?.formula?.color_latex_valid;
  }

  getPlaceholder(): string {
    const color = this.ci.exprModel?.color;
    if (!color) {
      return "";
    }

    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      return "";
    }

    const hexColor = parseInt(color.slice(1), 16);
    const r = (hexColor >> 16) & 255;
    const g = (hexColor >> 8) & 255;
    const b = hexColor & 255;
    return `\\operatorname{rgb}\\left(${r},${g},${b}\\right)`;
  }
}
