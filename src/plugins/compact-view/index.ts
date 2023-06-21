import { PluginController } from "../PluginController";
import "./compact.less";
import { Config, configList } from "./config";
import { MathQuillField, MathQuillView } from "components";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import { getController, mqKeystroke } from "plugins/intellisense/latex-parsing";

function focusmq(mq: MathQuillField | undefined) {
  // @ts-expect-error this works
  mq?.focus();
}

function childWidthSum(elem: HTMLElement) {
  //   return Array.from(elem.children).reduce(
  //     (prev, curr) => prev + curr.getBoundingClientRect().width,
  //     0
  //   );

  if (!elem.firstChild || !elem.lastChild) return 0;
  const range = document.createRange();
  range.setStartBefore(elem.firstChild);
  range.setEndAfter(elem.lastChild);
  return range.getBoundingClientRect().width;
}

enum CollapseMode {
  AtMaxWidth,
  Always,
}

export default class CompactView extends PluginController<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = true;
  static config = configList;

  pendingMultilinifications = new Set<HTMLElement>();

  lastRememberedCursorX: number | undefined = 0;

  afterConfigChange(): void {
    if (this.settings.multilineExpressions) {
      this.multilineExpressions({ type: "tick" });
      document.body.classList.add("multiline-expression-enabled");
    } else {
      this.unmultilineExpressions();
      document.body.classList.remove("multiline-expression-enabled");
    }

    if (this.settings.compactMode) {
      document.body.classList.add("compact-view-enabled");
    } else {
      document.body.classList.remove("compact-view-enabled");
    }
  }

  unmultilineExpressions() {
    const mathfields = document.querySelectorAll(".dcg-mq-root-block");
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
        ".dcg-selected .dcg-mq-root-block"
      );
    } else {
      mathfields = document.querySelectorAll(".dcg-mq-root-block");
    }

    for (const f of mathfields) {
      if (!(f instanceof HTMLElement)) continue;

      // don't re-verticalify everything unless editing
      if (f.dataset.isVerticalified && e.type !== "set-item-latex") continue;

      // don't re-verticalify short, unverticalified expressions
      if (!f.dataset.isVerticalified && childWidthSum(f) < 500) continue;

      // add to a queue of expressions that need to be verticalified
      this.enqueueVerticalifyOperation(f);

      f.dataset.isVerticalified = "true";
    }
  }

  afterEnable() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const cursor = document.querySelector(".dcg-mq-cursor");
        if (cursor) {
          this.lastRememberedCursorX = cursor.getBoundingClientRect().left;
        }
      }
    });
    document.addEventListener("mousedown", (e) => {
      setTimeout(() => {
        const cursor = document.querySelector(".dcg-mq-cursor");
        if (cursor) {
          this.lastRememberedCursorX = cursor.getBoundingClientRect().left;
        }

        const focusedmq = MathQuillView.getFocusedMathquill();
        if (focusedmq) {
          const ctrlr = getController(focusedmq);
          console.log("cursor", ctrlr.cursor);
        }
      });
    });

    this.afterConfigChange();

    setInterval(() => {
      const start = Date.now();
      for (const f of this.pendingMultilinifications) {
        unverticalify(f);
        const domManipHandlers: (() => void)[] = [];
        const commaBreaker = {
          symbol: ",",
          minWidth: 380,
          mode: CollapseMode.Always,
        };
        const equalsBreaker = {
          symbol: "=",
          minWidth: 380,
          mode: CollapseMode.Always,
        };
        const arithmeticBreakers = ["+", "−"].map((s) => ({
          symbol: s,
          minWidth: 380,
          mode: CollapseMode.AtMaxWidth,
        }));
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
              root: { symbols: [equalsBreaker] },
              other: { symbols: [] },
              list: {
                symbols: [{ ...commaBreaker, mode: CollapseMode.AtMaxWidth }],
              },
              piecewise: { symbols: [commaBreaker] },
            },
            skipWidth: 380,
          }
        );
        for (const h of domManipHandlers) h();
      }
      this.pendingMultilinifications = new Set();
      const end = Date.now();
      console.log("time", end - start);
    }, 50);

    Calc.controller.dispatcher.register((e) => {
      if (!this.settings.multilineExpressions) return;
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

    let focusedmq: MathQuillField | undefined =
      MathQuillView.getFocusedMathquill();

    Calc.controller.dispatcher.register((e) => {
      if (!this.settings.multilineExpressions) return;

      if (e.type === "set-focus-location") {
        setTimeout(
          () => (focusedmq = MathQuillView.getFocusedMathquill()),
          100
        );
      }

      if (e.type === "on-special-key-pressed") {
        // custom property that overrides any vertical nav functionality
        if (e.forceSwitchExpr) return;

        let i = 0;
        let linesPassed = 0;

        // vertical arrow nav
        if (e.key === "Down" || e.key === "Up") {
          const up = e.key === "Up";
          const arrowdir = up ? "Left" : "Right";
          const oppositeArrowdir = !up ? "Left" : "Right";

          // focus the mq element that was focused before hitting up/down
          focusmq(focusedmq);

          let nextFromBefore: Element | undefined | null;

          // we need a timeout here so the cursor position can update
          // (without this, it breaks for up but works fine for down)
          setTimeout(() => {
            if (!focusedmq) return;

            const cursor = document.querySelector(".dcg-mq-cursor");
            const originalCursorX =
              this.lastRememberedCursorX ??
              cursor?.getBoundingClientRect().left ??
              0;
            const cursorPositions: number[] = [];
            // keep on moving the cursor backward/forward until we find the next line
            const start = Date.now();

            const ctrlr = getController(focusedmq);
            // @ts-expect-error domfrag exists
            const domfragProto = Object.getPrototypeOf(ctrlr.cursor.domFrag());

            // prevent the cursor from updating html elements
            // by monkey patching the domfrag prototype
            const insDirOf = domfragProto.insDirOf;
            domfragProto.insDirOf = function () {
              return this;
            };

            let catchup = false;

            while (true) {
              // get cursor and adjacent element so we can figure out
              // if it's a line break
              const ctrlr = getController(focusedmq);
              let next = ctrlr.cursor?.[up ? -1 : 1]?._el; //up ? ctrlr.cursor?.[-1]?._el : ctrlr.cursor?.[1]?._el;

              let isNextRight = up;

              // if (next?.classList.contains("dcg-mq-bracket-container")) {
              //   mqKeystroke(focusedmq, arrowdir);
              //   next = ctrlr.cursor?.[up ? -1 : 1]?._el;
              //   mqKeystroke(focusedmq, oppositeArrowdir);
              // }

              // // if we can't directly get the next element,
              // // shift the cursor so that we can get access to it from the "other side"
              if (!next) {
                // next = ctrlr.cursor?.[1]?._el;
                mqKeystroke(focusedmq, arrowdir);
                // if (next === nextFromBefore) {
                next = ctrlr.cursor?.[up ? 1 : -1]?._el;
                isNextRight = !isNextRight;
                catchup = true;
                // }
                // //console.log("oldnext", next);
                // if (up) {
                //   next = ctrlr.cursor?.parent?.parent?._el;
                //   mqKeystroke(focusedmq, "Left");
                //   //mqKeystroke(focusedmq, "Right");
                //   //console.log("newnext", next);
                // } else {
                //   next = ctrlr.cursor?.parent?.parent?._el;
                //   mqKeystroke(focusedmq, "Right");
                //   //mqKeystroke(focusedmq, "Left");
                // }
                // if (!next?.classList.contains("dcg-mq-bracket-container")) {
                //   next = ctrlr.cursor?.[up ? -1 : 1]?._el;
                // }
              }

              // if the next elem is the same as the one from before, we've reached a dead end
              if (next === nextFromBefore) {
                // force it to go to the next expression
                // timeout is needed because dispatches can't trigger one another
                setTimeout(
                  () =>
                    Calc.controller.dispatch({ ...e, forceSwitchExpr: true }),
                  0
                );
                break;
              }
              nextFromBefore = next;

              if (!catchup) mqKeystroke(focusedmq, arrowdir);
              catchup = false;

              // now that we're on the next line, keep track of element bounding rects
              // we'll need them later to find the best place to put the cursor
              if (linesPassed === 1) {
                cursorPositions.push(
                  isNextRight
                    ? next?.getBoundingClientRect().right ?? 0
                    : next?.getBoundingClientRect().left ?? 0
                );
              }

              // if the next/prev element is a line break or paren enclosing multiline,
              // then we've reached the next line
              if (
                next instanceof HTMLElement &&
                // is the element a line break?
                next.dataset.isLineBreak !== undefined // ||
                // is the element a multiline bracket expression?
                // (!up &&
                //   next?.children[1] instanceof HTMLElement &&
                //   next?.children[1].dataset.isMultiline)
              ) {
                mqKeystroke(focusedmq, arrowdir);
                if (linesPassed === 1) break;
                linesPassed++;
              }
              i++;

              // failsafe prevent any infinite loop bugs
              if (
                // (i > 1000 ||
                //   (cursor?.parentElement?.classList.contains(
                //     "dcg-mq-root-block"
                //   ) &&
                //     // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                //     cursor === cursor?.parentElement?.lastChild) ||
                //   (cursor?.parentElement?.classList.contains(
                //     "dcg-mq-root-block"
                //   ) &&
                //     cursor === cursor?.parentElement?.firstChild)) &&
                // linesPassed === 0
                i > 1000
              ) {
                // force it to go to the next expression
                // timeout is needed because dispatches can't trigger one another
                setTimeout(
                  () =>
                    Calc.controller.dispatch({ ...e, forceSwitchExpr: true }),
                  0
                );
                break;
              }
            }
            domfragProto.insDirOf = insDirOf;

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

            const start2 = Date.now();

            // turn insDirOf into a no-op so the cursor can't change the HTML
            // and cause a ton of lag
            domfragProto.insDirOf = function () {
              return this;
            };
            mqKeystroke(
              focusedmq,
              new Array(bestIndex + 1).fill(oppositeArrowdir).join(" ")
            );

            // return the domfrag prototype to normal
            domfragProto.insDirOf = insDirOf;
            focusmq(focusedmq);
            mqKeystroke(focusedmq, oppositeArrowdir);

            const end2 = Date.now();
            console.log("only cursor movement perf", end2 - start2);

            const end = Date.now();
            console.log("cursor move perf", end - start);
          }, 0);
        }
      }
    });
  }

  afterDisable() {}
}

export interface VerticalifyContext {
  containerType:
    | "other"
    | "piecewise"
    | "functionCall"
    | "list"
    | "root"
    | "functionDef";
  enclosingBracketType: "paren" | "square" | "curly" | "abs" | undefined;
  domManipHandlers: (() => void)[];
}

function isVarNameElem(elem: Element) {
  return elem.tagName.toUpperCase() === "VAR";
}

function isSubscriptElem(elem: Element) {
  return elem.classList.contains("dcg-mq-supsub");
}

function outOfDateError(str: string) {
  // eslint-disable-next-line no-console
  console.error(`Compact View plugin may be out of date: ${str}`);
  // eslint-disable-next-line no-console
  console.trace();
}

// given a right dcg-mq-paren element, gets the type of bracket it represents
function getBracketType(
  elem: Element
): "paren" | "square" | "curly" | "abs" | undefined {
  // get the svg path
  const svgPath = elem?.children?.[0]?.children?.[0];

  // make sure it's an svg path
  if (!(svgPath instanceof SVGPathElement)) {
    outOfDateError(
      "Attempted to determine bracket type but could not identify it because SVG path does not exist."
    );
    return;
  }

  // make sure it has a "d" attribute
  const disambiguator = svgPath.getAttribute("d")?.[1];
  if (!disambiguator) {
    outOfDateError(
      "Attempted to determine bracket type but could not identify it because SVG path draw instructions do not exist."
    );
    return;
  }

  // each bracket has its own unique svg that also lets you tell exactly
  // what kind of bracket it is
  switch (disambiguator) {
    case "2":
      return "paren";
    case "3":
      return "square";
    case "4":
      return "abs";
    case "6":
      return "curly";
    default:
      outOfDateError(
        "Attempted to determine bracket type but could not identify it because SVG path draw instructions were unrecognizable."
      );
  }
}

interface VerticalifyOptions {
  // maps contexts to what should be collapsed, and how
  collapse: Record<
    VerticalifyContext["containerType"] | "all",
    {
      symbols: {
        symbol: string; // text to be collapsed
        minWidth: number; // min width for collapsing to be considered
        mode: CollapseMode; // normal word wrap, or collapse after every instance if too long?
      }[];
    }
  >;
  // skip parsing if width is less than this
  skipWidth: number;
}

function startsWithAnyOf(src: string, match: string[]) {
  for (const m of match) {
    if (src.startsWith(m)) return m;
  }
  return undefined;
}

function unverticalify(elem: Element) {
  // get all children
  const children = elem.querySelectorAll("*");

  for (const child of children) {
    if (child instanceof HTMLElement) {
      if (child.dataset.safeToReuse) break;
      delete child.dataset.isMultiline;

      // revert linebreaks to original symbol to get rid of <br>
      if (child.dataset.isLineBreak) {
        child.innerHTML = child.dataset.originalSymbol ?? "";
      }
      delete child.dataset.isLineBreak;
    }
  }
}

function verticalify(
  elem: Element,
  context: VerticalifyContext,
  options: VerticalifyOptions
) {
  // skip processing elements that are safe to reuse
  if (elem instanceof HTMLElement && elem.dataset.safeToReuse) return;

  // just handle the "center" element of bracket containers
  if (elem.classList.contains("dcg-mq-bracket-container")) {
    const bracketType = getBracketType(elem.children[2]);
    verticalify(
      elem.children[1],
      {
        ...context,
        enclosingBracketType: bracketType,
        containerType:
          bracketType === "curly"
            ? "piecewise"
            : bracketType === "square"
            ? "list"
            : context.containerType,
      },
      options
    );
    return;
  }

  const children = Array.from(elem.children);
  const newContext: VerticalifyContext = {
    ...context,
    containerType: "other",
    enclosingBracketType: undefined,
  };
  let hadSubscriptLast = false;
  if (elem instanceof HTMLElement) delete elem.dataset.isMultiline;

  let beforeEquals = false;

  // detect if root element has an equals sign
  // so we can specifically handle fn calls
  if (context.containerType === "root") {
    for (const child of children) {
      if (child.innerHTML.startsWith("=")) beforeEquals = true;
    }
  }

  // get width to decide whether to collapse in the first place
  const totalWidth =
    context.containerType === "root" && elem instanceof HTMLElement
      ? childWidthSum(elem)
      : elem.getBoundingClientRect().width;
  //   if (totalWidth < options.collapseWidth) return;

  let accumulatedWidth = 0;
  // collapse children
  for (const child of children) {
    // indicate that we've reached the equals sign
    if (context.containerType === "root" && child.innerHTML.startsWith("="))
      beforeEquals = false;

    const width = child.getBoundingClientRect().width;

    // accumulate width so we know when to break
    accumulatedWidth += width;

    // only html elements can become line breaks
    if (child instanceof HTMLElement) {
      const containerOptions = options.collapse[context.containerType];

      // try all symbols from current context
      // and also from the "all" context
      for (const s of [
        ...containerOptions.symbols,
        ...options.collapse.all.symbols,
      ]) {
        // can this element cause a line break?
        if (
          child.innerHTML.startsWith(s.symbol) &&
          ((s.mode === CollapseMode.Always && totalWidth > s.minWidth) ||
            (s.mode === CollapseMode.AtMaxWidth &&
              accumulatedWidth > s.minWidth))
        ) {
          context.domManipHandlers.push(() => {
            child.style.display = "inline";
            child.dataset.isLineBreak = "true";
            child.dataset.originalSymbol = s.symbol;
            child.innerHTML = s.symbol + "<br />";
            if (elem instanceof HTMLElement) elem.dataset.isMultiline = "true";
          });
          accumulatedWidth = 0;
          break;

          // if it can't and it is a line break somehow, make it not a line break
        } else {
          if (child.dataset.isLineBreak) {
            context.domManipHandlers.push(() => {
              child.innerHTML = child.dataset.originalSymbol ?? "";
              delete child.dataset.isLineBreak;
            });
          }
        }
      }
    }

    // verticalify child
    if (width > options.skipWidth) {
      verticalify(
        child,
        beforeEquals
          ? { ...context, containerType: "functionDef" }
          : newContext,
        options
      );
    }

    if (isVarNameElem(child)) {
      newContext.containerType = "functionCall";
    } else if (isSubscriptElem(child)) {
      if (hadSubscriptLast) {
        newContext.containerType = "other";
      } else {
        newContext.containerType = "functionCall";
      }
      hadSubscriptLast = true;
    } else {
      newContext.containerType = "other";
      hadSubscriptLast = false;
    }
  }

  // element should be considered "safe to reuse" until children change
  context.domManipHandlers.push(() => {
    if (elem instanceof HTMLElement) {
      elem.dataset.safeToReuse = "true";
      const observer = new MutationObserver(() => {
        observer.disconnect();
        delete elem.dataset.safeToReuse;
      });

      observer.observe(elem, {
        attributes: true,
        characterData: true,
        subtree: true,
        childList: true,
      });
    }
  });
}
