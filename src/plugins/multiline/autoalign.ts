function isComma(elem: HTMLElement) {
  return elem.tagName.toUpperCase() === "SPAN" && elem.innerText === ",";
}

export function isMatrix(container: HTMLElement) {
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
      if (!firstLine && commasInThisLine !== commasPerLine) {
        return;
      }
      firstLine = false;
      commasPerLine = commasInThisLine;
      commasInThisLine = 0;
    }
  }

  if (firstLine) return;

  return {
    commasPerLine,
  };
}

// Align a matrix. Don't check for elements
function alignMatrixNoCheck(
  container: HTMLElement,
  settings: {
    commasPerLine: number;
  }
) {
  const maxWidths = new Array(settings.commasPerLine).fill(0);

  const children = container.children;

  let commaIndex = 0;

  let currentRange = document.createRange();

  currentRange.setStartBefore(children[0]);

  const commas: {
    elem: HTMLElement;
    width: number;
  }[] = [];

  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    child.style.marginRight = "";
  }

  for (const child of children) {
    if (!(child instanceof HTMLElement)) continue;

    if (isComma(child)) {
      currentRange.setEndAfter(child);
      const thisRangeWidth = currentRange.getBoundingClientRect().width;
      maxWidths[commaIndex] = Math.max(maxWidths[commaIndex], thisRangeWidth);
      commaIndex++;
      currentRange = document.createRange();
      if (child.nextElementSibling)
        currentRange.setStartAfter(child.nextElementSibling);
      commas.push({ elem: child, width: thisRangeWidth });
    }

    if (child.dataset.isAutoLineBreak) {
      commaIndex = 0;
    }
  }

  commaIndex = 0;

  for (const comma of commas) {
    const padding = maxWidths[commaIndex] - comma.width;
    comma.elem.style.marginRight = `${padding}px`;
    commaIndex = (commaIndex + 1) % settings.commasPerLine;
  }
}

export function alignMatrix(
  container: HTMLElement,
  settings: {
    commasPerLine: number;
  }
) {
  alignMatrixNoCheck(container, settings);
}
