import { jquery } from "utils/depUtils";

// these are effectively private because they are not exported;
let showContextMenu = true;
let enabled = false;

// onEnable is automatically called when enabled by default
export function onEnable() {
  // prevent enabling it twice
  if (!enabled) {
    enabled = true;
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onMouseDown);
  }
}

export function onDisable() {
  // prevent disabling it twice
  if (enabled) {
    enabled = false;
    document.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("mousedown", onMouseDown);
  }
}

function onContextMenu(e: MouseEvent) {
  if (!showContextMenu) {
    showContextMenu = true;
    e.preventDefault();
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 2) {
    if (e.target === null) {
      return;
    }
    // assume the target is an HTMLElement
    const target = e.target as HTMLElement;
    const tag = target.tagName.toLowerCase();

    // determines if clicked target is an icon container
    const isIconContainer = (tagName: string, lvl: number, type: string) => {
      const container = seekParent(target, lvl);
      if (container === null) return false;
      return (
        tag === tagName &&
        "classList" in container &&
        container.classList.contains(`dcg-${type}-icon-container`)
      );
    };

    // determines if container is part of an expression or image
    const hasLongHoldButton = (lvl: number) => {
      const wrapper = seekParent(target, lvl + 1);
      if (wrapper === null) return false;
      if (typeof wrapper.classList === "undefined") return false;
      return wrapper.classList.contains("dcg-expression-icon-container");
    };

    if (
      // hidden color bubble of expressions or images
      isIconContainer("span", 2, "expression") &&
      hasLongHoldButton(1)
    ) {
      showContextMenu = false;
      jquery(seekParent(target, 1)).trigger("dcg-longhold");
    } else if (
      // shown color bubble of expressions
      isIconContainer("i", 3, "expression") &&
      hasLongHoldButton(2)
    ) {
      showContextMenu = false;
      jquery(seekParent(target, 2)).trigger("dcg-longhold");
    } else if (
      // hidden color bubble of table columns
      isIconContainer("span", 2, "table")
    ) {
      showContextMenu = false;
      jquery(seekParent(target, 1)).trigger("dcg-longhold");
    } else if (
      // shown color bubble of table columns
      isIconContainer("i", 3, "table")
    ) {
      showContextMenu = false;
      jquery(seekParent(target, 2)).trigger("dcg-longhold");
    }
  }
}

function seekParent(src: HTMLElement | null, level: number) {
  if (level <= 0) return src;

  for (let i = 0; i < level; ++i) {
    if (src != null) {
      src = src.parentElement;
    } else {
      return null;
    }
  }

  return src;
}
