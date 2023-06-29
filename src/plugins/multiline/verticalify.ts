import { Console } from "globals/window";

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
function childWidthSum(elem: HTMLElement) {
  if (!elem.firstChild || !elem.lastChild) return 0;
  const range = document.createRange();
  range.setStartBefore(elem.firstChild);
  range.setEndAfter(elem.lastChild);
  return range.getBoundingClientRect().width;
}

function isVarNameElem(elem: Element) {
  return elem.tagName.toUpperCase() === "VAR";
}

function isSubscriptElem(elem: Element) {
  return elem.classList.contains("dcg-mq-supsub");
}

function outOfDateError(str: string) {
  Console.error(`Multiline plugin may be out of date: ${str}`);
  Console.trace();
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

export enum CollapseMode {
  AtMaxWidth,
  Always,
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

export function unverticalify(elem: Element) {
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

export function verticalify(
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
    containerType:
      context.containerType === "piecewise" ? "piecewise" : "other",
    enclosingBracketType: undefined,
  };

  const originalNewContainerType = newContext.containerType;

  let hadSubscriptLast = false;
  if (elem instanceof HTMLElement) delete elem.dataset.isMultiline;

  let beforeEquals = false;

  // detect if root element has an equals sign
  // so we can specifically handle function signatures
  // separately from function calls
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
          // add a line break to this element
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
          // remove a line break from this element
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

    // if there's a variable name, any inner context immediately afterwards
    // which is surrounded by parentheses must be a function call
    if (isVarNameElem(child)) {
      newContext.containerType = "functionCall";

      // function names can also have exactly one subscript following a var name
    } else if (isSubscriptElem(child)) {
      if (hadSubscriptLast) {
        newContext.containerType = originalNewContainerType;
      } else if (newContext.containerType === "functionCall") {
        newContext.containerType = "functionCall";
      }
      hadSubscriptLast = true;

      // other cases don't have special meaning
    } else {
      newContext.containerType = originalNewContainerType;
      hadSubscriptLast = false;
    }
  }

  // element should be considered "safe to reuse" until it or its children change
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
