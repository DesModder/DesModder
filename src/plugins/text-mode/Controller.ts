import { Calc } from "globals/window";

export default class Controller {
  inTextMode: boolean = false;

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }
}
