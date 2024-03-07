/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { PluginController } from "../PluginController";
import { hookIntoOverrideKeystroke } from "src/utils/listenerHelpers";
import { MathQuillField, MathQuillView } from "src/components";
import { getController } from "../intellisense/latex-parsing";

import "./index.less";

const R = +1;
const L = -1;
type Dir = 1 | -1;

function isSupSubscriptMQElem(el?: HTMLElement) {
  return el?.classList.contains("dcg-mq-supsub");
}

function isWordMQElem(el?: HTMLElement) {
  return (
    el &&
    (el.classList.contains("dcg-mq-digit") ||
      el.tagName.toUpperCase() === "VAR" ||
      el.classList.contains("dcg-mq-supsub"))
  );
}

function isCtrlArrowSkippableSymbolMQElem(el?: HTMLElement) {
  return (
    el?.classList.contains("dcg-mq-bracket-container") ||
    el?.classList.contains("dcg-mq-fraction") ||
    el?.classList.contains("dcg-mq-large-operator") ||
    el?.classList.contains("dcg-mq-int") ||
    el?.classList.contains("dcg-mq-sqrt-container") ||
    el?.classList.contains("dcg-mq-nthroot-container")
  );
}

function isAtStartOrEndOfASubscriptOrSuperscript(mq: MathQuillField, dir: Dir) {
  const ctrlr = getController(mq);
  return (
    (ctrlr.cursor?.parent?._el?.classList.contains("dcg-mq-sup") ||
      ctrlr.cursor?.parent?._el?.classList.contains("dcg-mq-sub")) &&
    !ctrlr.cursor?.[dir]
  );
}

interface BetterNavSettings {
  ctrlArrow: boolean;
  scrollableExpressions: boolean;
}

const NavigationTable: Record<
  string,
  { dir: Dir; mode: "move" | "extend-sel" | "delete" }
> = {
  "Ctrl-Left": { dir: L, mode: "move" },
  "Ctrl-Right": { dir: R, mode: "move" },
  "Ctrl-Shift-Left": { dir: L, mode: "extend-sel" },
  "Ctrl-Shift-Right": { dir: R, mode: "extend-sel" },
  "Ctrl-Backspace": { dir: L, mode: "delete" },
  "Ctrl-Del": { dir: R, mode: "delete" },
};

export default class BetterNavigation extends PluginController<BetterNavSettings> {
  static id = "better-navigation" as const;
  static enabledByDefault = true;
  static config = [
    {
      type: "boolean",
      default: true,
      key: "ctrlArrow",
    },
    {
      type: "boolean",
      default: false,
      key: "scrollableExpressions",
    },
  ] as const;

  removeHandlers() {
    for (const removeHandler of this.customRemoveHandlers) removeHandler();
  }

  afterConfigChange(): void {
    document.body.classList.toggle(
      "dsm-better-nav-scrollable-expressions",
      this.settings.scrollableExpressions
    );
    this.removeHandlers();
  }

  dispatcherID: string | undefined;

  customRemoveHandlers: (() => void)[] = [];

  keydownHandler = () => {
    if (this.calc.focusedMathQuill && this.settings.ctrlArrow) {
      const remove = hookIntoOverrideKeystroke(
        this.calc.focusedMathQuill.mq,
        this.onMQKeystroke.bind(this),
        0,
        "better-nav-ctrl"
      );

      if (remove) this.customRemoveHandlers.push(remove);
    }
  };

  onMQKeystroke(key: string, _: KeyboardEvent) {
    const mq = MathQuillView.getFocusedMathquill();

    if (!mq) return true;
    const navOption = NavigationTable[key];
    if (!navOption) return true;

    // type an empty string to force desmos to update
    setTimeout(() => {
      this.calc.focusedMathQuill?.typedText("");
    }, 0);

    // backspace is implicitly "left"
    const dir = navOption.dir;
    const mode = navOption.mode;

    // remove the "Ctrl-" to get the normal arrow op to emulate
    const arrowOp = key.slice(5);

    const ctrlr = getController(mq);

    const next = ctrlr.cursor?.[navOption.dir];

    // if the next element is one of the following:
    // bracket, fraction, sum, product, integral, sqrt, nthroot
    // then skip over the entire thing when ctrl+arrowing (don't edit internals)
    // Shift-arrow already does this behavior perfectly so we first do that.
    // Then we do a normal arrow press to delete the selection.
    if (isCtrlArrowSkippableSymbolMQElem(next?._el)) {
      mq.keystroke(dir === R ? "Shift-Right" : "Shift-Left");

      // remove selection if not extending a selection
      if (mode !== "extend-sel") mq.keystroke(arrowOp);

      // skip over entire variable names, numbers, and operatornames
    } else if (
      isAtStartOrEndOfASubscriptOrSuperscript(mq, dir) ||
      (next && isWordMQElem(next._el))
    ) {
      // leave start/end of sub/sup
      if (isAtStartOrEndOfASubscriptOrSuperscript(mq, dir))
        mq.keystroke(arrowOp);

      let i = 0;
      while (isWordMQElem(ctrlr.cursor?.[dir]?._el) && i < 1000) {
        // skip over super/subscript
        if (isSupSubscriptMQElem(ctrlr.cursor?.[dir]?._el)) {
          mq.keystroke(dir === R ? "Shift-Right" : "Shift-Left");

          // remove selection if not extending selection
          if (mode !== "extend-sel") mq.keystroke(arrowOp);
        } else {
          mq.keystroke(arrowOp);
        }

        // if at the start/end of a subscript/superscript block,
        // then escape it
        if (isAtStartOrEndOfASubscriptOrSuperscript(mq, dir)) {
          mq.keystroke(arrowOp);
        }
        i++;
      }

      // treat it as a normal arrow key press in all other respects
    } else {
      mq.keystroke(arrowOp);
    }

    return false;
  }

  afterEnable() {
    this.afterConfigChange();
    document.addEventListener("keydown", this.keydownHandler);
  }

  afterDisable() {
    document.removeEventListener("keydown", this.keydownHandler);
    this.removeHandlers();
  }
}
