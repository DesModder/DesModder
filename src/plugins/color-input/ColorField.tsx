import ColorInput from ".";
import { Component, jsx } from "#DCGView";
import { InlineMathInputView, MathQuillView } from "#components";
// import { format } from "#i18n";
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
          <i class="dsm-icon-color" aria-hidden="true"></i>
        </div>
        <div class="dsm-color-input-container">
          <InlineMathInputView
            placeholder={() => this.ci.getPlaceholder()}
            ariaLabel={""}
            handleLatexChanged={(latex) => this.ci.setColorLatex(latex)}
            latex={() => this.ci.getColorLatex()}
            hasError={() => this.ci.hasError()}
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
              if (mq) this.ci.setColorLatex(mq.latex());
            }}
          />
        </div>
      </div>
    );
  }
}
