import { CalcController, FocusLocation } from "../globals/Calc.ts";

export interface FocusHelperOptions {
  controller: CalcController;
  location: FocusLocation;
}

export function manageFocusHelper(opts: FocusHelperOptions) {
  return {
    shouldBeFocused: () =>
      // This could just be a _.isEqual, but we don't have underscore.
      JSON.stringify(opts.location) ===
      JSON.stringify(opts.controller.getFocusLocation()),
    onFocusedChanged: (focused: boolean, _evt?: FocusEvent) => {
      if (focused) {
        opts.controller.dispatch({
          type: "set-focus-location",
          location: opts.location,
        });
      } else {
        opts.controller.dispatch({
          type: "blur-focus-location",
          location: opts.location,
        });
      }
    },
  };
}
