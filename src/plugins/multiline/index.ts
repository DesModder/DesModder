import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import "./multiline.less";
import { CollapseMode, unverticalify, verticalify } from "./verticalify";
import { MathQuillField, MathQuillView } from "components";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import { getController, mqKeystroke } from "plugins/intellisense/latex-parsing";
import {
  deregisterCustomDispatchOverridingHandler,
  registerCustomDispatchOverridingHandler,
} from "utils/listenerHelpers";

function focusmq(mq: MathQuillField | undefined) {
  mq?.focus();
}

export default class Multiline extends PluginController<Config> {
  static id = "multiline" as const;
  static enabledByDefault = false;
  static config = configList;

  pendingMultilinifications = new Set<HTMLElement>();

  lastRememberedCursorX: number | undefined = 0;

  multilineIntervalID: ReturnType<typeof setInterval> | undefined;

  lastEditTime: number = Date.now();

  afterConfigChange(): void {
    this.unmultilineExpressions();
    this.multilineExpressions({ type: "tick" });
    document.body.classList.add("multiline-expression-enabled");
  }

  unmultilineExpressions() {
    const mathfields = document.querySelectorAll(
      ".dcg-expressionitem .dcg-mq-root-block"
    );
    for (const f of mathfields) {
      if (!(f instanceof HTMLElement)) continue;
      unverticalify(f);
      delete f.dataset.isVerticalified;
    }
  }

  enqueueVerticalifyOperation(root: HTMLElement) {
    this.pendingMultilinifications.add(root);
  }

  multilineExpressions(e: DispatchedEvent) {
    // get all latex exprs
    let mathfields: NodeListOf<Element>;

    if (e.type === "set-item-latex") {
      mathfields = document.querySelectorAll(
        ".dcg-expressionitem.dcg-selected .dcg-mq-root-block"
      );
    } else {
      mathfields = document.querySelectorAll(
        ".dcg-expressionitem .dcg-mq-root-block"
      );
    }

    for (const f of mathfields) {
      if (!(f instanceof HTMLElement)) continue;

      // don't re-verticalify everything unless editing
      if (f.dataset.isVerticalified && e.type !== "set-item-latex") continue;

      // add to a queue of expressions that need to be verticalified
      this.enqueueVerticalifyOperation(f);

      f.dataset.isVerticalified = "true";
    }
  }

  dequeueAllMultilinifications() {
    for (const f of this.pendingMultilinifications) {
      // revert everything to its original state so we have proper width calculations
      unverticalify(f);

      // settings for where and how to put line breaks
      const domManipHandlers: (() => void)[] = [];
      const commaBreaker = {
        symbol: ",",
        minWidth: this.settings.widthBeforeMultiline,
        mode: CollapseMode.Always,
      };
      const equalsBreaker = {
        symbol: "=",
        minWidth: this.settings.widthBeforeMultiline,
        mode: CollapseMode.Always,
      };
      const arithmeticBreakers = ["+", "−", "·"].map((s) => ({
        symbol: s,
        minWidth: this.settings.widthBeforeMultiline,
        mode: CollapseMode.AtMaxWidth,
      }));

      // add line breaks
      verticalify(
        f,
        {
          enclosingBracketType: undefined,
          containerType: "root",
          domManipHandlers,
        },
        {
          collapse: {
            functionCall: { symbols: [commaBreaker] },
            functionDef: { symbols: [] },
            all: { symbols: [...arithmeticBreakers] },
            root: { symbols: [equalsBreaker, commaBreaker] },
            other: { symbols: [] },
            list: {
              symbols: [{ ...commaBreaker, mode: CollapseMode.AtMaxWidth }],
            },
            piecewise: { symbols: [commaBreaker] },
          },
          skipWidth: this.settings.widthBeforeMultiline,
        }
      );

      // perform all dom writing (to prevent getBoundingClientRect-related slowdowns)
      for (const h of domManipHandlers) h();
    }

    // clear multilinification cache
    this.pendingMultilinifications = new Set();
  }

  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const cursor = document.querySelector(".dcg-mq-cursor");
      if (cursor) {
        this.lastRememberedCursorX = cursor.getBoundingClientRect().left;
      }
    }

    if (e.key.toUpperCase() === "M" && e.ctrlKey) {
      this.dequeueAllMultilinifications();
    }
  };

  mousedownHandler = () => {
    setTimeout(() => {
      const cursor = document.querySelector(".dcg-mq-cursor");
      if (cursor) {
        this.lastRememberedCursorX = cursor.getBoundingClientRect().left;
      }
    });
  };

  dispatcherID: string | undefined;

  customDispatcherID: number | undefined;

  afterEnable() {
    document.addEventListener("keydown", this.keydownHandler);
    document.addEventListener("mousedown", this.mousedownHandler);

    this.afterConfigChange();

    this.multilineIntervalID = setInterval(() => {
      if (
        Date.now() - this.lastEditTime <
          this.settings.multilinifyDelayAfterEdit ||
        !this.settings.automaticallyMultilinify
      )
        return;

      this.dequeueAllMultilinifications();
    }, 0);

    this.dispatcherID = Calc.controller.dispatcher.register((e) => {
      if (
        e.type === "set-item-latex" ||
        e.type === "undo" ||
        e.type === "redo"
      ) {
        this.lastEditTime = Date.now();
      }

      if (
        e.type === "set-item-latex" ||
        e.type === "undo" ||
        e.type === "redo" ||
        e.type === "tick" ||
        e.type === "tick-ticker"
      ) {
        this.multilineExpressions(e);
      }
    });

    this.customDispatcherID = registerCustomDispatchOverridingHandler((evt) => {
      if (evt.type === "on-special-key-pressed") {
        if (evt.key === "Up" || evt.key === "Down") {
          if (!this.doMultilineVerticalNav(evt.key)) return false;
        }
      }
    }, 0);
  }

  afterDisable() {
    document.removeEventListener("keydown", this.keydownHandler);
    document.removeEventListener("mousedown", this.mousedownHandler);

    this.unmultilineExpressions();
    document.body.classList.remove("multiline-expression-enabled");

    if (this.dispatcherID)
      Calc.controller.dispatcher.unregister(this.dispatcherID);

    if (this.multilineIntervalID !== undefined)
      clearInterval(this.multilineIntervalID);

    if (this.customDispatcherID)
      deregisterCustomDispatchOverridingHandler(this.customDispatcherID);
  }

  // navigates up/down through a multiline expression
  // returns false or undefined if successful
  // returns true if at the start/end of a multiline expression
  doMultilineVerticalNav(key: "Up" | "Down" | "Shift-Up" | "Shift-Down") {
    const up = key === "Up" || key === "Shift-Up";
    const select = key.startsWith("Shift");

    const focusedmq = MathQuillView.getFocusedMathquill();

    let i = 0;
    let linesPassed = 0;

    const arrowdir = (select ? "Shift-" : "") + (up ? "Left" : "Right");
    const oppositeArrowdir =
      (select ? "Shift-" : "") + (!up ? "Left" : "Right");

    // focus the mq element that was focused before hitting up/down
    focusmq(focusedmq);

    let nextFromBefore: Element | undefined | null;

    // no need to do anything if there's no focused mathquill input
    // return true to make sure it does normal behavior
    if (!focusedmq) return true;

    // get the original cursor horizontal position
    // so we can snap to it later
    const cursor = document.querySelector(".dcg-mq-cursor");
    const originalCursorX =
      this.lastRememberedCursorX ?? cursor?.getBoundingClientRect().left ?? 0;
    const cursorPositions: number[] = [];

    const ctrlr = getController(focusedmq);
    // @ts-expect-error domfrag exists
    const domfragProto = Object.getPrototypeOf(ctrlr.cursor.domFrag());

    // prevent the cursor from updating html elements
    // by monkey patching the domfrag prototype
    const insAtDirEnd = domfragProto.insAtDirEnd;
    const insDirOf = domfragProto.insDirOf;
    const removeClass = domfragProto.removeClass;
    const addClass = domfragProto.addClass;
    domfragProto.insAtDirEnd = function () {
      return this;
    };
    domfragProto.insDirOf = function () {
      return this;
    };
    domfragProto.removeClass = function () {
      return this;
    };
    domfragProto.addClass = function () {
      return this;
    };

    // return the domfrag prototype to normal
    const cleanup = () => {
      domfragProto.insAtDirEnd = insAtDirEnd;
      domfragProto.removeClass = removeClass;
      domfragProto.addClass = addClass;
      domfragProto.insDirOf = insDirOf;
    };

    // ended with break statements
    while (true) {
      // get cursor and adjacent element so we can figure out
      // if it's a line break
      const ctrlr = getController(focusedmq);
      let next = ctrlr.cursor?.[up ? -1 : 1]?._el;

      // are we getting the right side or the left side
      // of the element? (e.g. the bounding client rect "left" or "right" property)
      let isNextRight = up;

      // go to next element
      mqKeystroke(focusedmq, arrowdir);

      // if we can't directly get the next element (e.g. end of a parenthesis block),
      // shift the cursor so that we can get access to it from the "other side"
      if (!next) {
        next = ctrlr.cursor?.[up ? 1 : -1]?._el;
        isNextRight = !isNextRight;
      }

      // if the next elem is the same as the one from before, we've reached a dead end
      // we only need to switch to next/prev expr if we haven't passed a line yet
      // because if we've already passed a line, we're just using it for searching for
      // an optimal x-position
      if (next === nextFromBefore && linesPassed === 0) {
        cleanup();
        return true;
      }

      // now that we're on the next line, keep track of element bounding rects
      // we'll need them later to find the best place to put the cursor
      if (linesPassed === 1) {
        cursorPositions.push(
          isNextRight
            ? next?.getBoundingClientRect().right ?? 0
            : next?.getBoundingClientRect().left ?? 0
        );
      }

      // if the next/prev element is a line break or if it hasn't changed,
      // then we've reached the next line
      if (
        (next instanceof HTMLElement &&
          // is the element a line break?
          next.dataset.isLineBreak !== undefined) ||
        next === nextFromBefore
      ) {
        mqKeystroke(focusedmq, arrowdir);
        if (linesPassed === 1) break;
        linesPassed++;
      }
      i++;
      nextFromBefore = next;

      // failsafe to prevent any infinite loop bugs
      if (i > 5000) {
        cleanup();
        return true;
      }
    }

    // find the place along the next line that best aligns with the cursor on the x-axis
    let lowestDiff = Infinity;
    let bestIndex = 0;
    cursorPositions.reverse();
    for (let i = 0; i < cursorPositions.length; i++) {
      const diff = Math.abs(cursorPositions[i] - originalCursorX);
      if (diff < lowestDiff) {
        lowestDiff = diff;
        bestIndex = i;
      }
    }

    // figure out how much we'll have to reverse to get there
    const loopCount = Math.max(
      0,
      Math.min(bestIndex + 1, cursorPositions.length - 1)
    );

    // go back to the optimal x-position
    for (let i = 0; i < loopCount; i++) {
      mqKeystroke(focusedmq, oppositeArrowdir);
    }

    // fix the domfrag prototype so the last keystroke will render the cursor
    cleanup();

    // go to final position and rerender cursor
    mqKeystroke(focusedmq, oppositeArrowdir);
  }
}
