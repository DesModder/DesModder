import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { wolfram2desmos, isIllegalASCIIMath } from "./wolfram2desmos";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

// https://stackoverflow.com/a/34278578
function typeInTextArea(
  newText: string,
  elm: Element | null = document.activeElement
) {
  const el = elm as HTMLTextAreaElement;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = el.value;
  const before = text.substring(0, start);
  const after = text.substring(end, text.length);
  el.value = before + newText + after;
  el.selectionStart = el.selectionEnd = start + (newText?.length ?? 0);
  el.focus();
}

// This controller manages the focus events of Expression panel

export default class WolframToDesmos extends PluginController {
  static id = "wolfram2desmos" as const;
  static enabledByDefault = true;
  static config = configList;

  configFlags = {
    reciprocalExponents2Surds: false, // converts ^(1/#) to surd
    derivativeLoopLimit: true, // converts (d^#/dx^#) to (d/dx)... # times, limited to 10 iterations
  };

  panel: HTMLElement | null = null;
  enabled = true;
  focusHandler = this._focusHandler.bind(this);
  pasteHandler = this._pasteHandler.bind(this);

  afterEnable(config: Config) {
    this.panel = document.querySelector(".dcg-exppanel-outer");
    this.panel?.addEventListener("focusin", this.focusHandler, false);
    this.panel?.addEventListener("focusout", this.focusHandler, false);
    this.applyConfigFlags(config);
  }

  afterDisable() {
    this.panel?.removeEventListener("focusin", this.focusHandler, false);
    this.panel?.removeEventListener("focusout", this.focusHandler, false);
    this.enabled = false;
  }

  onConfigChange(config: Config) {
    this.applyConfigFlags(config);
  }

  _focusHandler(e: FocusEvent) {
    const elem = e.target as HTMLElement;
    // Observe textarea and input tags
    const isTarget = ["textarea", "input"].includes(elem.tagName.toLowerCase());
    if (isTarget && this.enabled) this.onFocus(e);
  }

  onFocus(e: FocusEvent) {
    const elem: HTMLElement | null | undefined = (e.target as HTMLElement)
      ?.parentElement?.parentElement;
    switch (e.type) {
      case "focusin":
        elem?.addEventListener("paste", this.pasteHandler, false);
        break;
      case "focusout":
        elem?.removeEventListener("paste", this.pasteHandler, false);
        break;
    }
  }

  applyConfigFlags(config: Config) {
    this.configFlags = config;
  }

  _pasteHandler(e: ClipboardEvent) {
    const elem = e.target as HTMLElement;
    const pasteData = e.clipboardData?.getData("Text");

    if (
      !(elem?.classList.contains("dcg-label-input") ?? true) &&
      pasteData !== undefined &&
      pasteData !== "" &&
      Calc.controller.getItemModel(Calc.selectedExpressionId)?.type ===
        "expression" &&
      isIllegalASCIIMath(pasteData)
    ) {
      e.stopPropagation();
      e.preventDefault();
      typeInTextArea(wolfram2desmos(pasteData, this.configFlags));
    }
  }
}
WolframToDesmos satisfies Plugin;
