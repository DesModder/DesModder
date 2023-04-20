import { format } from "../i18n/i18n-core";
import { postMessageUp } from "../utils/messages";
import panicHTML from "./panic.html";

function insertPanicElement() {
  const frag = document.createRange().createContextualFragment(panicHTML);
  document.body.appendChild(frag);
  document
    .getElementById("dsm-panic-apply-reload-btn")!
    .addEventListener("click", () => {
      const inputs: HTMLInputElement[] = Array.from(
        document.querySelectorAll("#dsm-panic-popover ul input")
      );
      postMessageUp({
        type: "set-plugins-force-disabled",
        value: inputs
          .filter((el) => el.checked)
          .map((el) => el.dataset.plugin)
          .filter((n): n is string => n !== undefined),
      });
      location.reload();
    });
  document
    .getElementById("dsm-panic-close-button")!
    .addEventListener("click", () => {
      document.body.classList.add("dsm-panic-closed");
    });
  document
    .getElementById("dsm-panic-reopen-button")!
    .addEventListener("click", () => {
      document.body.classList.remove("dsm-panic-closed");
    });
}

function getPanicPopover() {
  return document.getElementById("dsm-panic-popover");
}

function ensurePanicPopover() {
  if (getPanicPopover() === null) insertPanicElement();
  return getPanicPopover()!;
}

/** Returns the new list item */
function addLabelledCheckboxItem(list: Element, plugin: string) {
  list.appendChild(
    document.createRange().createContextualFragment(`<li>
      <label>
        <input type="checkbox" />
      </label>
    </li>`)
  );
  const li = list.lastElementChild!;
  // We're panicking anyways. Don't worry about language changing.
  // eslint-disable-next-line rulesdir/no-format-in-ts
  const humanName = format(plugin + "-name", undefined, plugin);
  li.querySelector("label")!.appendChild(document.createTextNode(humanName));
  li.querySelector("input")!.dataset.plugin = plugin;
  return li;
}

export const existingPanics = new Set<string>();
export function addPanic(plugin: string) {
  console.warn("Panicking for plugin", plugin);
  const panicPopover = ensurePanicPopover();
  document.getElementById("dsm-encountered-errors")!.style.display = "unset";
  if (!existingPanics.has(plugin)) {
    const list = panicPopover.querySelector("ul#dsm-panic-list")!;
    addLabelledCheckboxItem(list, plugin);
  }
  existingPanics.add(plugin);
}

export function addForceDisabled(plugin: string) {
  const panicPopover = ensurePanicPopover();
  document.getElementById("dsm-plugins-disabled")!.style.display = "unset";
  const list = panicPopover.querySelector("ul#dsm-disabled-list")!;
  const li = addLabelledCheckboxItem(list, plugin);
  li.querySelector("input")!.checked = true;
}
