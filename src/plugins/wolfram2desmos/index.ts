import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { wolfram2desmos, isIllegalASCIIMath } from "./wolfram2desmos";
import { Calc } from "#globals";

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

export default class WolframToDesmos extends PluginController<Config> {
  static id = "wolfram2desmos" as const;
  static enabledByDefault = true;
  static config = configList;

  panel: HTMLElement | null = null;
  enabled = true;
  focusHandler = this._focusHandler.bind(this);
  pasteHandler = this._pasteHandler.bind(this);

  afterEnable() {
    this.panel = document.querySelector(".dcg-exppanel-outer");
    this.panel?.addEventListener("focusin", this.focusHandler, false);
    this.panel?.addEventListener("focusout", this.focusHandler, false);
  }

  afterDisable() {
    this.panel?.removeEventListener("focusin", this.focusHandler, false);
    this.panel?.removeEventListener("focusout", this.focusHandler, false);
    this.enabled = false;
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
      typeInTextArea(wolfram2desmos(pasteData, this.settings));
    }
  }
}
