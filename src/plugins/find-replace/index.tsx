import { PluginController, Replacer } from "../PluginController";
import { refactor, refactorInItem } from "./backend";
import { DispatchedEvent } from "src/globals";
import { ComponentTemplate, jsx } from "#DCGView";
import { If } from "#components";
import ReplaceBar from "./ReplaceBar";

export default class FindReplace extends PluginController {
  static id = "find-and-replace" as const;
  static enabledByDefault = true;
  replaceLatex = "";
  vanillaShouldShowReplaceIcon: undefined | (() => boolean);

  afterEnable(): void {
    this.calc.setState(this.calc.getState(), { allowUndo: true });
    this.vanillaShouldShowReplaceIcon = this.cc.shouldShowReplaceIcon.bind(
      this.cc
    );
    this.cc.shouldShowReplaceIcon = () => {
      if (this.vanillaShouldShowReplaceIcon!()) return true;
      return this.isReplaceValid();
    };
  }

  afterDisable(): void {
    this.cc.shouldShowReplaceIcon = this.vanillaShouldShowReplaceIcon!;
  }

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

  handleDispatchedAction(evt: DispatchedEvent) {
    switch (evt.type) {
      case "rename-identifier-in-item":
        if (this.isNativeRenameActive()) return;
        this.cc.runAfterDispatch(() => this.refactorInItem(evt.id));
        return "abort-later-handlers";
    }
    return undefined;
  }
}
