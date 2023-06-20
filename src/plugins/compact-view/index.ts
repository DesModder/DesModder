import { PluginController } from "../PluginController";
import { MathQuillField, MathQuillView } from "components";
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

export default class CompactView extends PluginController {
  static id = "compact-view" as const;
  static enabledByDefault = true;

  afterEnable() {
    document.styleSheets[0].insertRule(`.dcg-mq-bracket-container {
      vertical-align: middle;
  }`);
    document.styleSheets[0].insertRule(`.dcg-mq-bracket-middle {
      font-size: calc(max(10px, 0.9em)) !important;
  }`);
    document.styleSheets[0].insertRule(`.dcg-main {
  padding: 0 35px !important;
  margin-left: 4px !important;
  font-size: 12px !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-inFolder .dcg-main {
        margin-left: 30px !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-caret-container {
padding: 7px !important;
margin-left: -8px !important;
transform: scale(0.8);
margin-top: -5px;
}`);
    document.styleSheets[0].insertRule(`.dcg-fade-container {
padding-bottom: 0 !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-circular-icon-container {
transform: translate(11px, -18px) scale(0.5) !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-icon-remove {
transform: translate(7px, -7px) scale(0.6);
}`);
    document.styleSheets[0].insertRule(`.dcg-expressionitem {
border-color: #666666;
}`);
    document.styleSheets[0].insertRule(`.dcg-smart-textarea-container {
font-size: 12px !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-slider-container {
min-height: 0 !important;
}`);
    document.styleSheets[0].insertRule(`.dcg-track .dcg-graphic {
height: 2px !important;
background-color: #999999 !important;
}`);
    //     document.styleSheets[0].insertRule(`.dcg-expression-bottom {
    // height: 12px !important;
    // }`);

    document.styleSheets[0].insertRule(`.dcg-thumb .dcg-graphic {
    width: 0 !important;
    height: 0 !important;
    }`);
    document.styleSheets[0].insertRule(`.dcg-thumb .dcg-center {
        transform: translateY(-2px) scale(0.4) !important;
        }`);
    document.styleSheets[0].insertRule(`.dcg-thumb:hover .dcg-center {
                transform: translateY(-2px) scale(0.8) !important;
                }`);
    document.styleSheets[0].insertRule(`.dcg-evaluation-container {
                                    position: absolute;
                                    right: 15px;
                                    top: 5px;
                                    font-size: 10px !important;
                                    max-width: 10% !important;
                                    overflow: hidden !important;
                                    transition: max-width 0.25s, overflow 0.25s;
                                    }`);
    document.styleSheets[0].insertRule(`.dcg-evaluation-container:hover {
                                                        max-width: 100% !important;
                                                        overflow: auto !important;
                                                        }`);

    Calc.controller.dispatcher.register((e) => {
      if (
        e.type === "set-item-latex" ||
        e.type === "undo" ||
        e.type === "redo" ||
        e.type === "tick" ||
        e.type === "tick-ticker"
      ) {
        const mathfields = document.querySelectorAll(".dcg-mq-root-block");
        for (const f of mathfields) {
          if (!(f instanceof HTMLElement)) continue;

          if (f.dataset.isVerticalified && e.type !== "set-item-latex")
            continue;
          if (childWidthSum(f) < 500) continue;
          verticalify(f, {
            enclosingBracketType: undefined,
            containerType: "other",
          });

          f.dataset.isVerticalified = "true";
        }
      }
    });

    let focusedmq: MathQuillField | undefined =
      MathQuillView.getFocusedMathquill();

    Calc.controller.dispatcher.register((e) => {
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
        if (!focusedmq) return;

        // vertical arrow nav
        if (e.key === "Down" || e.key === "Up") {
          const up = e.key === "Up";
          const arrowdir = up ? "Left" : "Right";

          // focus the mq element that was focused before hitting up/down
          focusmq(focusedmq);
          console.log(focusedmq);

          // we need a timeout here so the cursor position can update
          // (without this, it breaks for up but works fine for down)
          setTimeout(() => {
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
                console.log("should focus next/prev");

                // force it to go to the next expression
                setTimeout(
                  () =>
                    Calc.controller.dispatch({ ...e, forceSwitchExpr: true }),
                  0
                );
                //focusmq(nextmq);
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
  containerType: "other" | "piecewise" | "function";
  enclosingBracketType: "paren" | "square" | "curly" | "abs" | undefined;
  possiblyFunctionSignature?: boolean;
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

function verticalify(elem: Element, context: VerticalifyContext) {
  // just handle the "center" element of bracket containers
  if (elem.classList.contains("dcg-mq-bracket-container")) {
    const bracketType = getBracketType(elem.children[2]);
    verticalify(elem.children[1], {
      ...context,
      enclosingBracketType: bracketType,
      containerType:
        bracketType === "curly" ? "piecewise" : context.containerType,
    });
    return;
  }

  const children = Array.from(elem.children);
  const newContext: VerticalifyContext = {
    containerType: "other",
    enclosingBracketType: undefined,
  };
  let hadSubscriptLast = false;
  if (elem instanceof HTMLElement) delete elem.dataset.isMultiline;

  let hasEquals = false;

  if (elem.classList.contains("dcg-mq-root-block")) {
    for (const child of children) {
      if (child.innerHTML.startsWith("=")) hasEquals = true;
    }
  }

  const totalWidth =
    elem.classList.contains("dcg-mq-root-block") && elem instanceof HTMLElement
      ? childWidthSum(elem)
      : elem.getBoundingClientRect().width;

  if (totalWidth < 380) return;

  for (const child of children) {
    if (
      elem.classList.contains("dcg-mq-root-block") &&
      child.innerHTML.startsWith("=")
    )
      hasEquals = false;
    verticalify(
      child,
      hasEquals ? { ...context, possiblyFunctionSignature: true } : newContext
    );

    if (child instanceof HTMLElement) {
      if (
        (context.containerType === "piecewise" ||
          context.containerType === "function" ||
          elem.classList.contains("dcg-mq-root-block")) &&
        !context.possiblyFunctionSignature
      ) {
        if (
          (child.classList.length === 0 &&
            child.tagName.toUpperCase() === "SPAN" &&
            child.innerHTML === ",") ||
          (elem.classList.contains("dcg-mq-root-block") &&
            child.innerHTML === "=")
        ) {
          child.style.display = "inline";
          child.dataset.isLineBreak = "true";
          child.innerHTML = child.innerHTML + "<br />";
          if (elem instanceof HTMLElement) elem.dataset.isMultiline = "true";
        }
      } else {
        if (child.dataset.isLineBreak) {
          child.innerHTML = child.innerHTML[0];
          delete child.dataset.isLineBreak;
        }
      }
    }

    if (isVarNameElem(child)) {
      newContext.containerType = "function";
    }
    if (isSubscriptElem(child)) {
      if (hadSubscriptLast) {
        newContext.containerType = "other";
      } else {
        newContext.containerType = "function";
      }
      hadSubscriptLast = true;
    } else {
      hadSubscriptLast = false;
    }
  }
}
