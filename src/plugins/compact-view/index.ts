import { PluginController } from "../PluginController";
import "./compact.css";
import "./compact.less";
import { Config, configList } from "./config";
import { Calc } from "globals/window";

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

    for (const item of mathitems) {
      if (item instanceof HTMLElement) {
        const rootblock = item.querySelector(".dcg-main .dcg-mq-root-block");
        const rootBlockWidth = rootblock?.getBoundingClientRect().width ?? 0;

        let rootblockInnerWidth = 0;
        if (rootblock?.firstChild && rootblock?.lastChild) {
          const range = new Range();
          range.setStartBefore(rootblock?.firstChild);
          range.setEndAfter(rootblock?.lastChild);
          rootblockInnerWidth = range.getBoundingClientRect().width;
        }

        const evalMaxWidth = rootBlockWidth - rootblockInnerWidth;
        const evaluation = item.querySelector(".dcg-evaluation");
        if (evaluation && evaluation instanceof HTMLElement)
          evaluation.style.maxWidth = `${Math.max(evalMaxWidth - 5, 20)}px`;
      }
    }
  }

  afterEnable() {
    Calc.controller.dispatcher.register((e) => {
      if (!this.settings.hideEvaluations) return;
      this.updateHiddenEvaluations();
    });
    this.afterConfigChange();
    document.body.classList.add("compact-view-enabled");
  }

  afterDisable() {
    document.body.classList.remove("compact-view-enabled");
  }
}
