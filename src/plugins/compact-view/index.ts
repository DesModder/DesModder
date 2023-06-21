import { PluginController } from "../PluginController";
import "./compact.less";
import { Config, configList } from "./config";
import { MathQuillField, MathQuillView } from "components";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import { mqKeystroke } from "plugins/intellisense/latex-parsing";

function focusmq(mq: MathQuillField | undefined) {
  // @ts-expect-error this works
  mq?.focus();
}

function childWidthSum(elem: HTMLElement) {
  return Array.from(elem.children).reduce(
    (prev, curr) => prev + curr.getBoundingClientRect().width,
    0
  );
}

enum CollapseMode {
  AtMaxWidth,
  Always,
}

export default class CompactView extends PluginController<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = true;
  static config = configList;

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

      // unverticalify expression so it's possible to retrieve accurate width info
      unverticalify(f);
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
      const arithmeticBreakers = ["+", "-"].map((s) => ({
        symbol: s,
        minWidth: 380,
        mode: CollapseMode.AtMaxWidth,
      }));
      verticalify(
        f,
        {
          enclosingBracketType: undefined,
          containerType: "root",
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
        }
      );

      f.dataset.isVerticalified = "true";
    }
  }

  afterEnable() {
    this.afterConfigChange();

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

        // vertical arrow nav
        if (e.key === "Down" || e.key === "Up") {
          const up = e.key === "Up";
          const arrowdir = up ? "Left" : "Right";

          // focus the mq element that was focused before hitting up/down
          focusmq(focusedmq);

          // we need a timeout here so the cursor position can update
          // (without this, it breaks for up but works fine for down)
          setTimeout(() => {
            if (!focusedmq) return;
            // keep on moving the cursor backward/forward
            while (true) {
              // get cursor and adjacent element so we can figure out
              // if it's a line break
              const cursor = document.querySelector(".dcg-mq-cursor");
              const next = up
                ? cursor?.nextElementSibling
                : cursor?.previousElementSibling;

              // if the next/prev element is a line break or paren enclosing multiline,
              // then we've reached the next line
              if (
                // don't stop the loop at iteration zero because we need to move at least
                // one space to switch lines
                i !== 0 &&
                next instanceof HTMLElement &&
                // is the element a line break?
                (next.dataset.isLineBreak !== undefined ||
                  // is the element a multiline bracket expression?
                  (next.children[1] instanceof HTMLElement &&
                    next.children[1].dataset.isMultiline))
              ) {
                break;
              }
              mqKeystroke(focusedmq, arrowdir);
              i++;

              // if we can't find a comma, navigate to next expression as normal
              if (
                i > 1000 ||
                (cursor?.parentElement?.classList.contains(
                  "dcg-mq-root-block"
                ) &&
                  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                  cursor === cursor?.parentElement?.lastChild) ||
                (cursor?.parentElement?.classList.contains(
                  "dcg-mq-root-block"
                ) &&
                  cursor === cursor?.parentElement?.firstChild)
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
  const svgPath = elem?.children?.[0]?.children?.[0];
  if (!(svgPath instanceof SVGPathElement)) {
    outOfDateError(
      "Attempted to determine bracket type but could not identify it because SVG path does not exist."
    );
    return;
  }

  const disambiguator = svgPath.getAttribute("d")?.[1];
  if (!disambiguator) {
    outOfDateError(
      "Attempted to determine bracket type but could not identify it because SVG path draw instructions do not exist."
    );
    return;
  }

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
  collapse: Record<
    VerticalifyContext["containerType"] | "all",
    {
      symbols: {
        symbol: string;
        minWidth: number;
        mode: CollapseMode;
      }[];
    }
  >;
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

    // accumulate width so we know when to break
    accumulatedWidth += child.getBoundingClientRect().width;

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
          child.style.display = "inline";
          child.dataset.isLineBreak = "true";
          child.dataset.originalSymbol = s.symbol;
          child.innerHTML = s.symbol + "<br />";
          if (elem instanceof HTMLElement) elem.dataset.isMultiline = "true";
          accumulatedWidth = 0;
          break;

          // if it can't and it is a line break somehow, make it not a line break
        } else {
          if (child.dataset.isLineBreak) {
            child.innerHTML = child.dataset.originalSymbol ?? "";
            delete child.dataset.isLineBreak;
          }
        }
      }
    }

    // verticalify child
    verticalify(
      child,
      beforeEquals ? { ...context, containerType: "functionDef" } : newContext,
      options
    );

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
}
