import { PluginController, Replacer } from "../PluginController";
import { refactor, refactorInItem } from "./backend";
import { DispatchedEvent } from "src/globals";
import { ComponentTemplate, DCGView, jsx } from "#DCGView";
import { If } from "#components";
import ReplaceBar from "./ReplaceBar";
import { manageFocusHelper } from "../../utils/manage-focus-helper.ts";
import "./find-replace.less";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "find-replace": {
      type: "dsm-fr-rename-identifier-in-item";
      id: string;
    };
  }
}

export default class FindReplace extends PluginController {
  static id = "find-and-replace" as const;
  static enabledByDefault = true;
  replaceLatex = "";

  getReplaceLatex() {
    return this.replaceLatex;
  }

  setReplaceLatex(latex: string) {
    this.replaceLatex = latex;
  }

  isReplaceValid() {
    const search = this.cc.getExpressionSearchStr();
    return search.length > 0 && !this.isNativeRenameActive();
  }

  isNativeRenameActive() {
    const renameReplace = this.cc.getExpressionReplaceStr();
    return renameReplace.length > 0;
  }

  refactorAll() {
    if (!this.isReplaceValid()) return;
    refactor(this.calc, this.cc.getExpressionSearchStr(), this.replaceLatex);
  }

  refactorInItem(id: string) {
    if (!this.isReplaceValid()) return;
    refactorInItem(
      this.calc,
      this.cc.getExpressionSearchStr(),
      this.replaceLatex,
      id
    );
  }

  focusSearch() {
    this.cc.dispatch({
      type: "set-focus-location",
      location: { type: "search-expressions" },
    });
  }

  replaceSearchView: Replacer = (searchBar: ComponentTemplate) => (
    <div class="dsm-find-replace-search-bar-container">
      {searchBar}
      <If predicate={() => !this.isNativeRenameActive()}>
        {() => <ReplaceBar fr={this} />}
      </If>
    </div>
  );

  replaceTopLevelIcon(id: string, iconType: () => string): Replacer {
    return (topLevelIcon: ComponentTemplate) => (
      <span>
        <If predicate={() => iconType() === "delete" && this.isReplaceValid()}>
          {() => (
            <div
              class="dcg-top-level-icon dcg-tappable dsm-extra-rename-btn"
              tabIndex={DCGView.const(0)}
              onTap={() =>
                this.cc.dispatch({
                  type: "dsm-fr-rename-identifier-in-item",
                  id,
                })
              }
              role="button"
              manageFocus={DCGView.const(
                manageFocusHelper({
                  controller: this.cc,
                  location: {
                    type: "dsm-focus",
                    plugin: "find-and-replace",
                    kind: "replace-button",
                    id,
                  },
                })
              )}
            >
              <i class="dcg-icon-replace" aria-hidden="true" />
            </div>
          )}
        </If>
        {topLevelIcon}
      </span>
    );
  }

  handleDispatchedAction(evt: DispatchedEvent) {
    if (evt.type === "dsm-fr-rename-identifier-in-item") {
      this.cc.runAfterDispatch(() => this.refactorInItem(evt.id));
      return "abort-later-handlers";
    }
  }
}
