import { Calc, Fragile } from "../../globals/window";
import "./hide-errors.less";
import { Plugin } from "plugins";

let enabled: boolean = false;
let initOnce: boolean = false;

function initPromptSlider() {
  // Reduce suggested slider count to 3
  // Avoids overflowing on narrow expression lists since we've added the "hide" button.
  // getMissingVariables is used in different ways, but we care about
  //    t.getMissingVariables().slice(0, 4)
  const proto = Fragile.PromptSliderView?.prototype;
  const oldGMV = proto.getMissingVariables;
  proto.getMissingVariables = function () {
    const missing = oldGMV.call(this);
    missing.slice = function () {
      if (
        enabled &&
        arguments.length === 2 &&
        arguments[0] === 0 &&
        arguments[1] === 4
      ) {
        return Array.prototype.slice.call(missing, 0, 3);
      } else {
        return Array.prototype.slice.apply(missing, arguments as any);
      }
    };
    return missing;
  };
}

const hideErrors: Plugin = {
  id: "hide-errors",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {
    if (!initOnce) {
      initOnce = true;
      initPromptSlider();
    }
    enabled = true;
    Calc.controller.updateViews();
  },
  onDisable: () => {
    enabled = false;
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
};
export default hideErrors;
