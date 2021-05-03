// hide keypad button if play preview expanded
const showKeypadButton: HTMLElement | null = document.querySelector(
  ".dcg-show-keypad"
);
if (showKeypadButton !== null) {
  showKeypadButton.hidden =
    this.controller.isMainViewOpen && this.controller.isPlayPreviewExpanded;
}
