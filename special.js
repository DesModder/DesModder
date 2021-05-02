// don't exit open menu if play preview expanded
if (
  keys.lookup(e) === "Esc" &&
  // SPECIAL
  !this.controller.isPlayPreviewExpanded
) {
  this.controller.closeMainView();
}

// hide keypad button if play preview expanded
const showKeypadButton: HTMLElement | null = document.querySelector(
  ".dcg-show-keypad"
);
if (showKeypadButton !== null) {
  showKeypadButton.hidden =
    this.controller.isMainViewOpen && this.controller.isPlayPreviewExpanded;
}

// be able to switch between menus
