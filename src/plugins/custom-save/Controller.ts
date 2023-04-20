import { desModderController } from "script";

function updateView() {
  desModderController.updateMenuView();
}

export default class Controller {
  checked: Boolean;

  constructor() {
    this.checked = false;
  }

  isChecked() {
    return this.checked;
  }

  check() {
    this.checked = !this.checked;
    updateView();
  }
}
