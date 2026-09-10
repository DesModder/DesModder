import { DesModderHooks } from "./globals/Calc.ts";
import DSM from "./MainController.ts";

export function makeControllerHooks(dsm: DSM): DesModderHooks {
  return {
    isCurrentFocusLocationValid(location) {
      switch (location.plugin) {
        case "video-creator":
          return !!dsm.videoCreator?.isMenuOpen();
        case "find-and-replace":
          return dsm.cc.getExpressionSearchOpen();
        case "code-golf":
          // only focus location is the `dummy-mq` one.
          return false;
        case "vector-tools":
          return dsm.vectorTools?.isFocused(location.kind) ?? false;
        case "physics-lab":
          return dsm.physicsLab?.isFocused(location.kind) ?? false;
        default:
          location satisfies never;
          return false;
      }
    },
    getFocusedItem(_location) {
      // none of the focus locations are currently inside an expression.
      return undefined;
    },
    isExpressionListFocused(_location) {
      // none of the focus locations are currently inside an expression.
      return false;
    },
    needsFakeKeypad(location) {
      switch (location.plugin) {
        case "video-creator":
          return true;
        case "find-and-replace":
          return location.kind !== "replace-button";
        case "code-golf":
          // only focus location is the `dummy-mq` one.
          return false;
        case "vector-tools":
          // The panel's component slots are real math fields.
          return true;
        case "physics-lab":
          // So are the slope-field and exact-value inputs.
          return true;
        default:
          location satisfies never;
          return false;
      }
    },
  };
}
