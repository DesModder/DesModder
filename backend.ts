import { jquery } from "desmodder";

// these are effectively private because they are not exported;
let showContextMenu = true;
let enabled = true;

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

function onContextMenu(e: any) {
  if (!showContextMenu) {
    showContextMenu = true;
    e.preventDefault();
  }
}

function onMouseDown(e: any) {
  if (e.button === 2) {
    let tag: any = e.target.tagName.toLowerCase();

    // determines if clicked target is an icon container
    let isIconContainer: any = (tagName: string, lvl: number, type: string) => {
      let container: any = seekParent(e.target, lvl);
      if (container === null) return false;
      return (
        tag === tagName &&
        "classList" in container &&
        container.classList.contains(`dcg-${type}-icon-container`)
      );
    };

    // determines if container is part of an expression or image
    let hasLongHoldButton: any = (lvl: number) => {
      let wrapper: any = seekParent(e.target, lvl + 1);
      if (wrapper === null) return false;
      if (typeof wrapper.classList === "undefined") return false;
      return wrapper.classList.contains("dcg-expression-icon-container") !== -1;
    };

    if (
      // hidden color bubble of expressions or images
      isIconContainer("span", 2, "expression") &&
      hasLongHoldButton(1)
    ) {
      showContextMenu = false;
      jquery(seekParent(e.target, 1)).trigger("dcg-longhold");
    } else if (
      // shown color bubble of expressions
      isIconContainer("i", 3, "expression") &&
      hasLongHoldButton(2)
    ) {
      showContextMenu = false;
      jquery(seekParent(e.target, 2)).trigger("dcg-longhold");
    } else if (
      // hidden color bubble of table columns
      isIconContainer("span", 2, "table")
    ) {
      showContextMenu = false;
      jquery(seekParent(e.target, 1)).trigger("dcg-longhold");
    } else if (
      // shown color bubble of table columns
      isIconContainer("i", 3, "table")
    ) {
      showContextMenu = false;
      jquery(seekParent(e.target, 2)).trigger("dcg-longhold");
    }
  }
}

function seekParent(src: any, level: number) {
  if (level <= 0) return src;

  for (var i = 0; i < level; ++i) {
    if (src != null) {
      src = src.parentElement;
    } else {
      return null;
    }
  }

  return src;
}
