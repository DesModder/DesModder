import { Calc, TableParse } from "desmodder";
import Controller from "./Controller";
import { wolfram2desmos } from "./wolfram2desmos";

// initialize controller and observe textarea and input tags
let controller: Controller = new Controller(["textarea", "input"], function (
  e: FocusEvent
) {
  let elem: HTMLElement | null | undefined = (e.target as HTMLElement)
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
  newText: string | undefined,
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
  let elem = e.target as HTMLElement;
  let pasteData = e.clipboardData?.getData("Text");

  if (
    !(elem?.classList.contains("dcg-label-input") ?? true) &&
    pasteData !== "" &&
    Calc.controller.getItemModel(Calc.selectedExpressionId).type === "expression" &&
    TableParse(pasteData??'') === undefined && 
    (pasteData = wolfram2desmos(pasteData)) !== null
  ) {
    e.stopPropagation();
    e.preventDefault();
    typeInTextArea(pasteData);
  }
}

export function onEnable() {
  controller.enable();
}

export function onDisable() {
  controller.disable();
}

export default {
  id: "wolfram2desmos",
  name: "Wolfram To Desmos",
  description:
    "Lets you paste ASCIIMath (such as the results of Wolfram Alpha queries) into Desmos.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
