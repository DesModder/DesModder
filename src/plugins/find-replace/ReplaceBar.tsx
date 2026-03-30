import FindReplace from ".";
import "./ReplaceBar.less";
import { Component, jsx } from "#DCGView";
import { MathQuillView } from "#components";
import { format } from "#i18n";
import { autoOperatorNames } from "#utils/depUtils.ts";
import { FocusLocation } from "../../globals";

export default class ReplaceBar extends Component<{
  fr: FindReplace;
}> {
  fr!: FindReplace;

  init() {
    this.fr = this.props.fr();
  }

  template() {
    return (
      <div class="dsm-find-replace-expression-replace-bar">
        <div class="dcg-expression-search-bar">
          <div class="dcg-search-mathquill-container">
            <MathQuillView
              latex={() => this.fr.getReplaceLatex()}
              capExpressionSize={false}
              config={{ autoOperatorNames }}
              isFocused={() => this.isFocused()}
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
              onFocusedChanged={(focused) => {
                const location: FocusLocation = {
                  type: "dsm-focus",
                  plugin: "find-and-replace",
                  id: "replace-bar",
                };
                if (focused) {
                  this.fr.cc.dispatch({
                    type: "set-focus-location",
                    location,
                  });
                } else {
                  this.fr.cc.dispatch({
                    type: "blur-focus-location",
                    location,
                  });
                }
              }}
              hasError={false}
              selectOnFocus
              noFadeout
            />
            {/* dcg-icon-search applies placement + icon, and
              dcg-icon-caret-right overrides icon to be the caret */}
            <i class="dcg-icon-search dcg-icon-caret-right" />
          </div>
          {/* Using a standard Button looks horrible on the gray background */}
          <span
            class={() => ({
              "dsm-find-replace-replace-all": true,
              "dsm-disabled": !this.fr.isReplaceValid(),
            })}
            role="button"
            tabIndex={0}
            onTap={() => this.fr.refactorAll()}
          >
            {format("find-and-replace-replace-all")}
          </span>
        </div>
      </div>
    );
  }

  isFocused() {
    const location = this.fr.cc.getFocusLocation();
    return (
      location?.type === "dsm-focus" &&
      location.plugin === "find-and-replace" &&
      location.id === "replace-bar"
    );
  }

  closeReplace() {
    this.fr.cc.dispatch({
      type: "close-expression-search",
    });
  }

  didMount() {
    this.fr.focusSearch();
  }
}
