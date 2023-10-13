function isComma(elem: HTMLElement) {
  return elem.tagName.toUpperCase() === "SPAN" && elem.innerText === ",";
}

function isDigit(elem?: Element | null) {
  return elem?.classList.contains("dcg-mq-digit") ?? false;
}

export function isGrid(container: HTMLElement) {
  const children = container.children;

  let firstLine = true;

  let commasPerLine = 0;
  let commasInThisLine = 0;

  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    if (isComma(child)) {
      commasInThisLine++;
    }

    if (child.dataset.isAutoLineBreak) {
      firstLine = false;
      commasPerLine = Math.max(commasPerLine, commasInThisLine);
      commasInThisLine = 0;
    }
  }

  if (firstLine || commasPerLine < 2) return;

  return true;
}

function findNonLineBreakElement(
  child: HTMLElement,
  successor: (e: Element) => Element | null
) {
  let next: Element | null = successor(child);

  while (
    !(next instanceof HTMLElement) ||
    !!next.dataset.isLineBreak ||
    !!next.dataset.isManualLineBreak ||
    next.classList.contains("dcg-mq-cursor")
  ) {
    if (!next) return;
    next = successor(next);
  }
  return next;
}

function getNextNonLineBreakElement(child: HTMLElement) {
  return findNonLineBreakElement(child, (child) => child.nextElementSibling);
}

function getPrevNonLineBreakElement(child: HTMLElement) {
  return findNonLineBreakElement(
    child,
    (child) => child.previousElementSibling
  );
}

// Align a grid. Don't check for elements
function alignGridNoCheck(container: HTMLElement) {
  const maxWidths: number[] = [];

  const children = container.children;

  let commaIndex = 0;

  let currentRange = document.createRange();

  currentRange.setStartBefore(children[0]);

  let rangeStart = children[0] as HTMLElement;

  const commas: {
    start: HTMLElement;
    elem: HTMLElement;
    width: number;
    index: number;
  }[] = [];

  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    child.style.marginRight = "";
    child.style.marginLeft = "";
    child.style.borderBottom = "";
  }

  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    if (
      isComma(child) ||
      child === container.lastElementChild ||
      child.dataset.isAutoLineBreak
    ) {
      currentRange.setEndAfter(child);
      const thisRangeWidth = child.dataset.isAutoLineBreak
        ? 0
        : currentRange.getBoundingClientRect().width;
      maxWidths[commaIndex] = Math.max(
        maxWidths[commaIndex] ?? 0,
        thisRangeWidth
      );
      commas.push({
        elem: child,
        width: thisRangeWidth,
        start: rangeStart,
        index: commaIndex,
      });
      commaIndex++;
      currentRange = document.createRange();
      const nextNonLineBreak = getNextNonLineBreakElement(child);
      if (nextNonLineBreak) {
        currentRange.setStartBefore(nextNonLineBreak);
        rangeStart = nextNonLineBreak;
      } else {
        break;
      }

      const prev = getPrevNonLineBreakElement(child);
      console.log(prev, nextNonLineBreak);

      if (
        child.dataset.isAutoLineBreak &&
        prev instanceof HTMLElement &&
        isDigit(prev) &&
        isDigit(nextNonLineBreak)
      ) {
        prev.style.borderBottom = "2px solid red";
      }
    }

    if (child.dataset.isAutoLineBreak) {
      commaIndex = 0;
    }
  }

  commaIndex = 0;

  for (const comma of commas) {
    const padding = maxWidths[comma.index] - comma.width + 5;
    comma.elem.style.marginRight = `${padding / 2}px`;
    comma.start.style.marginLeft = `${padding / 2}px`;
  }
}

export function alignGrid(container: HTMLElement) {
  alignGridNoCheck(container);
  container.dataset.isCenterAligned = "true";
}
