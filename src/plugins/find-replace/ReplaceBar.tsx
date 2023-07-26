import FindReplace from ".";
import "./ReplaceBar.less";
import { Component, jsx } from "DCGView";
import { MathQuillView } from "components";
import { Calc } from "globals/window";
import { format } from "i18n/i18n-core";
import { autoOperatorNames } from "utils/depUtils";

export default class ReplaceBar extends Component<{
  fr: FindReplace;
}> {
  fr!: FindReplace;

  init() {
    this.fr = this.props.fr();
  }

  template() {
    return (
      <div class="dcg-expression-search-bar">
        <div class="dcg-search-mathquill-container">
          <MathQuillView
            latex={() => this.fr.getReplaceLatex()}
            capExpressionSize={false}
            config={{ autoOperatorNames }}
            isFocused={false}
            getAriaLabel="expression replace"
            getAriaPostLabel=""
            onUserChangedLatex={(e: string) => this.fr.setReplaceLatex(e)}
            onUserPressedKey={(key: string, e: KeyboardEvent) => {
              if (key === "Enter") {
                this.fr.refactorAll();
              } else if (key === "Esc") {
                this.closeReplace();
              } else if (key === "Ctrl-F") {
                this.fr.focusSearch();
              } else {
                const focusedMQ = MathQuillView.getFocusedMathquill();
                if (focusedMQ) {
                  focusedMQ.keystroke(key, e);
                  this.fr.setReplaceLatex(focusedMQ.latex());
                }
              }
            }}
            onFocusedChanged={() => {}}
            hasError={false}
            selectOnFocus
            noFadeout
          />
          {/* dcg-icon-search applies placement + icon, and
            dcg-icon-caret-right overrides icon to be the caret */}
          <i class="dcg-icon-search dcg-icon-caret-right" />
        </div>
        {/* Using a standard Button looks horrible on the gray background */}
        <div
          class="dsm-find-replace-replace-all"
          role="button"
          onTap={() => this.fr.refactorAll()}
        >
          {format("find-and-replace-replace-all")}
        </div>
      </div>
    );
  }

  closeReplace() {
    Calc.controller.dispatch({
      type: "close-expression-search",
    });
  }

  didMount() {
    this.fr.focusSearch();
  }
}
