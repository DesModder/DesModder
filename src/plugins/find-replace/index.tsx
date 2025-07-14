import { PluginController, Replacer } from "../PluginController";
import { refactor } from "./backend";
import { ComponentTemplate, jsx } from "#DCGView";
import ReplaceBar from "./ReplaceBar";

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
    return this.cc.getExpressionSearchStr().length > 0;
  }

  refactorAll() {
    if (!this.isReplaceValid()) return;
    refactor(this.calc, this.cc.getExpressionSearchStr(), this.replaceLatex);
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
      <ReplaceBar fr={this} />
    </div>
  );
}
