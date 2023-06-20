import { PluginController } from "../PluginController";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { mqKeystroke } from "plugins/intellisense/latex-parsing";

function focusmq(mq: MathQuillField | undefined) {
  // @ts-expect-error this works
  mq?.focus();
}

export default class CompactView extends PluginController {
  static id = "compact-view" as const;
  static enabledByDefault = true;

  afterEnable() {
    Calc.controller.dispatcher.register((e) => {
      if (e.type === "set-item-latex") {
        const mathfields = document.querySelectorAll(".dcg-mq-root-block");
        for (const f of mathfields) {
          verticalify(f, {
            enclosingBracketType: undefined,
            containerType: "other",
          });
          document.styleSheets[0].insertRule(`.dcg-mq-bracket-container {
            vertical-align: middle;
        }`);
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
        if (e.forceSwitchExpr) return;

        // next mathquill input that would've been navigated to
        // if it weren't for vertical nav
        const nextmq = MathQuillView.getFocusedMathquill();
        let i = 0;

        if (!focusedmq) return;

        // arrow nav down arrow
        if (e.key === "Down" || e.key === "Up") {
          const up = e.key === "Up";
          const arrowdir = up ? "Left" : "Right";
          // focus the mq element that was focused before hitting up/down
          focusmq(focusedmq);

          setTimeout(() => {
            // keep on moving the cursor backward/forward
            while (true) {
              // if the prev/next element is a line break or paren enclosing multiline,
              // go pass it to reach next line and then stop moving
              const cursor = document.querySelector(".dcg-mq-cursor");
              const next = up
                ? cursor?.nextElementSibling
                : cursor?.previousElementSibling;
              if (i < 10) console.log(next);
              if (
                i !== 0 &&
                next instanceof HTMLElement &&
                // is the element a line break?
                (next.dataset.isLineBreak !== undefined ||
                  // is the element a multiline bracket expression?
                  (next.children[1] instanceof HTMLElement &&
                    next.children[1].dataset.isMultiline))
              ) {
                console.log("up to", next);
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
  for (const child of children) {
    verticalify(child, newContext);

    if (child instanceof HTMLElement) {
      if (
        context.containerType === "piecewise" ||
        context.containerType === "function"
      ) {
        if (
          child.classList.length === 0 &&
          child.tagName.toUpperCase() === "SPAN" &&
          child.innerHTML === ","
        ) {
          child.dataset.isLineBreak = "true";
          child.innerHTML = ",<br />";
          if (elem instanceof HTMLElement) elem.dataset.isMultiline = "true";
        }
      } else {
        if (child.dataset.isLineBreak) {
          child.innerHTML = ",";
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
