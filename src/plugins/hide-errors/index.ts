import { Fragile } from "../../globals/window";
import { Inserter } from "../../preload/replaceElement";
import { PluginController, Replacer } from "../PluginController";
import { ErrorTriangle } from "./components/ErrorTriangle";
import { HideButton } from "./components/HideButton";
import "./hide-errors.less";
import { facetSourcesSpec } from "dataflow";

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

declare module "dataflow" {
  interface Computed {
    hideErrorsButton: Inserter<any>; // Some type of model
  }
}

export default class HideErrors extends PluginController {
  static id = "hide-errors" as const;
  static enabledByDefault = true;

  computed = facetSourcesSpec({
    hideErrorsButton: {
      value: (model) => HideButton(this, () => model),
    },
  });

  afterEnable() {
    if (!initOnce) {
      initOnce = true;
      initPromptSlider();
    }
    enabled = true;
  }

  afterDisable() {
    enabled = false;
  }

  hideError(id: string) {
    this.dsm.metadata?.updateExprMetadata(id, {
      errorHidden: true,
    });
  }

  toggleErrorHidden(id: string) {
    this.dsm.metadata?.updateExprMetadata(id, {
      errorHidden: !this.isErrorHidden(id),
    });
  }

  isErrorHidden(id: string) {
    return this.dsm.metadata?.getDsmItemModel(id)?.errorHidden;
  }

  errorTriangle(id: string): Replacer {
    return (inner: any) => ErrorTriangle(this, id, inner);
  }
}
