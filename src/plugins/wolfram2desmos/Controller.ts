import { Config } from "./config";
import { OptionalProperties } from "utils/utils";

/*
 This controller manages the focus events of Expression panel
*/

export default class Controller {
  // I was going to use jquery but for now I'm going to use vanilla js
  readonly panel: HTMLElement | null;
  readonly onFocus: (evtInfo: FocusEvent) => void;

  filterTag: string[];
  enabled: boolean = false;

  public configFlags = {
    reciprocalExponents2Surds: false, // converts ^(1/#) to surd
    derivativeLoopLimit: true, // converts (d^#/dx^#) to (d/dx)... # times, limited to 10 iterations
  };

  constructor(filterTag: string[], callback: (evtInfo: FocusEvent) => void) {
    this.panel = document.querySelector(".dcg-exppanel-outer");
    this.onFocus = callback;
    this.filterTag = filterTag;
    const focusHandler = (e: FocusEvent) => {
      // used arrow function to allow "this" to point to the class instance
      const elem: HTMLElement = e.target as HTMLElement;
      const isTarget: boolean = this.filterTag.includes(
        elem.tagName.toLowerCase()
      );
      if (isTarget && this.enabled) {
        callback(e);
      }
    };

    this.panel?.addEventListener("focusin", focusHandler, false);
    this.panel?.addEventListener("focusout", focusHandler, false);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  applyConfigFlags(changes: OptionalProperties<Config>) {
    this.configFlags = {
      ...this.configFlags,
      ...changes,
    };
  }
}
