import Controller from "./Controller";
import { Config, configList } from "./config";
import { wolfram2desmos, isIllegalASCIIMath } from "./wolfram2desmos";
import { Calc } from "globals/window";
import { Plugin } from "plugins";
import { OptionalProperties } from "utils/utils";

// initialize controller and observe textarea and input tags
export const controller = new Controller(["textarea", "input"], function (
  e: FocusEvent
) {
  const elem: HTMLElement | null | undefined = (e.target as HTMLElement)
    ?.parentElement?.parentElement;
  switch (e.type) {
    case "focusin":
      elem?.addEventListener("paste", pasteHandler, false);
      break;
    case "focusout":
      elem?.removeEventListener("paste", pasteHandler, false);
      break;
    default:
      break;
  }
});

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

function pasteHandler(e: ClipboardEvent) {
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
    typeInTextArea(wolfram2desmos(pasteData));
  }
}

export function onEnable(config: Config) {
  controller.applyConfigFlags(config);
  controller.enable();
  return controller;
}

export function onDisable() {
  controller.disable();
}

const w2d: Plugin = {
  id: "wolfram2desmos",
  onEnable,
  onDisable,
  enabledByDefault: true,
  config: configList,
  onConfigChange(changes: OptionalProperties<Config>) {
    controller.applyConfigFlags(changes);
  },
};
export default w2d;
