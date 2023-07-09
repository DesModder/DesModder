import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { pluginSettings } from "../../state/pluginSettings";
import { onState } from "../../state/utils";
import { CMPlugin } from "../CMPlugin";
import "./compact.css";
import "./compact.less";
import { Config, configList } from "./config";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";

function toggleBodyClass(className: string, bool: boolean) {
  document.body.classList.toggle(className, bool);
}

export default class CompactView extends CMPlugin<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = false;

  onConfigChange(): void {
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

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    this.dispatcherID = Calc.controller.dispatcher.register(() => {
      if (!this.settings.hideEvaluations) return;
      this.updateHiddenEvaluations();
    });
    this.onConfigChange();
    document.body.classList.add("compact-view-enabled");
  }

  destroy() {
    if (this.dispatcherID)
      Calc.controller.dispatcher.unregister(this.dispatcherID);
    document.body.classList.remove("compact-view-enabled");
  }
}

export function compactView(dsm: MainController): CMPluginSpec<CompactView> {
  return {
    id: CompactView.id,
    category: "visual",
    config: configList,
    plugin: ViewPlugin.define((view) => new CompactView(view, dsm), {
      provide: () => [
        onState(pluginSettings, () => {
          dsm.cmPlugin("compact-view")?.onConfigChange();
        }),
      ],
    }),
    extensions: [],
  };
}
