import window, { Console } from "../globals/window";
import { format } from "#i18n";
import { PluginID } from "../plugins";
import { Block } from "../preload/replacementHelpers/parse";
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
          .filter((n): n is PluginID => n !== undefined),
      });
      location.reload();
    });
  document.querySelectorAll(".dsm-panic-close-button").forEach((n) =>
    n.addEventListener("click", () => {
      document.body.classList.remove("dsm-panic-open");
    })
  );
  document
    .getElementById("dsm-panic-reopen-button")!
    .addEventListener("click", () => {
      document.body.classList.add("dsm-panic-open");
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
  // eslint-disable-next-line @desmodder/eslint-rules/no-format-in-ts
  const humanName = format(plugin + "-name", undefined, plugin);
  li.querySelector("label")!.appendChild(document.createTextNode(humanName));
  li.querySelector("input")!.dataset.plugin = plugin;
  return li;
}

export const panickedPlugins = new Set<string>();
function addPanickedPlugin(plugin: string) {
  if (window.DesModderPreload?.pluginsForceDisabled.has(plugin as any)) {
    return;
  }
  Console.warn("Panicking for plugin", plugin);
  const panicPopover = ensurePanicPopover();
  document
    .querySelectorAll(".dsm-encountered-errors")
    .forEach((n) => ((n as HTMLElement).style.display = "unset"));
  if (!panickedPlugins.has(plugin)) {
    const list = panicPopover.querySelector("ul#dsm-panic-list")!;
    addLabelledCheckboxItem(list, plugin);
  }
  panickedPlugins.add(plugin);
}

export function addPanic(block: Block) {
  block.plugins.forEach(addPanickedPlugin);
  const description = document.createElement("li");
  description.innerText = block.description;
  document
    .getElementById("dsm-patch-description-list")!
    .appendChild(description);
}

export function addForceDisabled(plugin: string) {
  const panicPopover = ensurePanicPopover();
  document.getElementById("dsm-plugins-disabled")!.style.display = "unset";
  const list = panicPopover.querySelector("ul#dsm-disabled-list")!;
  const li = addLabelledCheckboxItem(list, plugin);
  li.querySelector("input")!.checked = true;
}
