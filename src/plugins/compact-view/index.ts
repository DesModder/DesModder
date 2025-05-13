import { PluginController } from "../PluginController";
import "./compact.less";
import { Config, configList } from "./config";

function toggleBodyClass(className: string, bool: boolean) {
  document.body.classList.toggle(className, bool);
}

export default class CompactView extends PluginController<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = false;
  static config = configList;

  afterConfigChange(): void {
    toggleBodyClass(
      "compact-view-remove-spacing-enabled",
      this.settings.compactFactor > 0
    );
    toggleBodyClass(
      "compact-view-no-separating-lines",
      this.settings.noSeparatingLines
    );
    toggleBodyClass(
      "compact-view-highlight-alternating-lines",
      this.settings.highlightAlternatingLines
    );
    toggleBodyClass(
      "compact-view-hide-evaluations-enabled",
      this.settings.hideEvaluations
    );
    toggleBodyClass("hide-folder-toggles", this.settings.hideFolderToggles);

    document.body.style.setProperty(
      "--math-font-size",
      `${this.settings.mathFontSize}px`
    );
    document.body.style.setProperty(
      "--text-font-size",
      `${this.settings.textFontSize}px`
    );
    document.body.style.setProperty(
      "--bracket-font-size-factor",
      `${this.settings.bracketFontSizeFactor}em`
    );

    document.body.style.setProperty(
      "--minimum-font-size",
      `${this.settings.minimumFontSize}px`
    );
    document.body.style.setProperty(
      "--dsm-compact-mode-multiplier",
      `${this.settings.compactFactor}`
    );

    if (this.settings.hideEvaluations) {
      this.updateHiddenEvaluations();
    }
  }

  updateHiddenEvaluations() {
    const mathitems = document.querySelectorAll(
      ".dcg-mathitem.dcg-expressionitem"
    );

    // go through all math expressions
    for (const item of mathitems) {
      if (item instanceof HTMLElement) {
        // make sure the math expression has an evaluation in it
        const evaluation = item.querySelector(".dcg-evaluation");
        if (!evaluation || !(evaluation instanceof HTMLElement)) continue;

        // get the width of the expression
        const rootblock = item.querySelector(".dcg-main .dcg-mq-root-block");
        const rootBlockWidth = rootblock?.getBoundingClientRect().width ?? 0;

        // get the width of the actual math in the expression
        let rootblockInnerWidth = 0;
        if (rootblock?.firstChild && rootblock?.lastChild) {
          const range = new Range();
          range.setStartBefore(rootblock?.firstChild);
          range.setEndAfter(rootblock?.lastChild);
          rootblockInnerWidth = range.getBoundingClientRect().width;
        }

        // figure out the remaining width that can be used for the evaluation
        const evalMaxWidth = rootBlockWidth - rootblockInnerWidth;

        // set the evaluation's max width so that it fills the available space
        evaluation.style.maxWidth = `${Math.max(evalMaxWidth - 5, 20)}px`;
      }
    }
  }

  dispatcherID: string | undefined;

  afterEnable() {
    this.dispatcherID = this.cc.dispatcher.register(() => {
      if (!this.settings.hideEvaluations) return;
      this.updateHiddenEvaluations();
    });
    this.afterConfigChange();
    document.body.classList.add("compact-view-enabled");
  }

  afterDisable() {
    if (this.dispatcherID) this.cc.dispatcher.unregister(this.dispatcherID);
    document.body.classList.remove("compact-view-enabled");
  }
}
