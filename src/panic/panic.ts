import { format } from "../i18n/i18n-core";
import panicHTML from "./panic.html";

const existingPanics = new Set<string>();

function insertPanicElement() {
  const frag = document.createRange().createContextualFragment(panicHTML);
  document.body.appendChild(frag);
  document
    .getElementById("dsm-panic-apply-reload-btn")!
    .addEventListener("click", () => {
      // TODO: apply changes;
      location.reload();
    });
}

function getPanicPopover() {
  return document.getElementById("dsm-panic-popover");
}

function ensurePanicPopover() {
  const popover = getPanicPopover();
  if (popover === null) insertPanicElement();
  return getPanicPopover()!;
}

export function addPanic(problem: string) {
  const panicPopover = ensurePanicPopover();
  if (!existingPanics.has(problem)) {
    const id = "dsm_panic_" + problem;
    const idInQuotes = JSON.stringify(id);
    const list = panicPopover.querySelector("ul")!;
    list.appendChild(
      document.createRange().createContextualFragment(`<li>
      <label for=${idInQuotes}>
        <input type="checkbox" id=${idInQuotes} />
      </label>
    </li>`)
    );
    const problemName = format(problem + "-name", undefined, problem);
    list
      .lastElementChild!.querySelector("label")!
      .appendChild(document.createTextNode(problemName));
    console.log("panicking for", problem);
  }
  existingPanics.add(problem);
}
