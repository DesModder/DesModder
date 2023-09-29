import { PluginController } from "../PluginController";
import { generateBracketPairColorizationCSS } from "./bracket-pair-colorization";
import { Config, configList } from "./config";
import "./index.less";

// assumes valid input;
export function hex2rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export default class SyntaxHighlighting extends PluginController<Config> {
  static id = "syntax-highlighting" as const;
  static enabledByDefault = false;
  static config = configList;

  styles = document.createElement("style");

  caretBracketContainer: HTMLElement | null = null;
  mouseBracketContainer: HTMLElement | null = null;

  afterConfigChange(): void {
    this.resetHighlightedRanges();

    const bpcCss = this.settings.bracketPairColorization
      ? generateBracketPairColorizationCSS(
          this.settings.bracketPairColorizationColors.map((c) => hex2rgb(c)),
          this.settings.bpcColorInText,
          this.settings.thickenBrackets
        )
      : [];

    while ((this.styles.sheet?.cssRules?.length ?? 0) > 0) {
      this.styles.sheet?.deleteRule(0);
    }

    for (const rule of bpcCss) {
      this.styles.sheet?.insertRule(rule);
    }

    document.body.classList.toggle(
      "dsm-syntax-highlighting-underline-highlighted-ranges",
      this.settings.underlineHighlightedRanges
    );
  }

  resetHighlightedRanges() {
    this.changeCaretElement(null);
    this.changeMouseOverElement(null);
  }

  changeCaretElement(el: HTMLElement | null) {
    const oldcaretBracketContainer = this.caretBracketContainer;
    this.caretBracketContainer = el;

    if (oldcaretBracketContainer !== this.caretBracketContainer) {
      if (oldcaretBracketContainer)
        delete oldcaretBracketContainer.dataset.containsCaret;
      if (this.caretBracketContainer)
        this.caretBracketContainer.dataset.containsCaret = "true";
    }
  }

  changeMouseOverElement(el: HTMLElement | null) {
    delete this.mouseBracketContainer?.dataset.isDirectlyHovered;
    this.mouseBracketContainer = el;
    if (this.mouseBracketContainer)
      this.mouseBracketContainer.dataset.isDirectlyHovered = "true";
  }

  onMouseOver = (e: MouseEvent) => {
    if (!this.settings.highlightBracketBlocksHover) return;

    const el = e.target;

    if (!(el instanceof Element)) return;

    const closestMQBC = el.closest(".dcg-mq-bracket-container");
    this.changeMouseOverElement(closestMQBC as HTMLElement | null);
  };

  onKeyDown = () => {
    this.changeMouseOverElement(null);
  };

  onWheel = () => {
    this.changeMouseOverElement(null);
  };

  onClick = () => {
    this.changeMouseOverElement(null);
  };

  highlightedRangeInterval!: ReturnType<typeof setInterval>;

  afterEnable(): void {
    document.head.appendChild(this.styles);
    this.afterConfigChange();

    this.highlightedRangeInterval = setInterval(() => {
      if (!this.settings.highlightBracketBlocks) return;

      const cursor = document.querySelector(".dcg-mq-cursor");
      if (cursor) {
        const newCursorEl = cursor.closest(".dcg-mq-bracket-container");
        this.changeCaretElement(newCursorEl as HTMLElement | null);
      } else {
        this.changeCaretElement(null);
      }
    });

    document.addEventListener("mouseover", this.onMouseOver);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("wheel", this.onWheel);
    document.addEventListener("click", this.onClick);
  }

  afterDisable(): void {
    clearInterval(this.highlightedRangeInterval);
    document.head.removeChild(this.styles);
    document.removeEventListener("mouseover", this.onMouseOver);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("click", this.onClick);
    this.resetHighlightedRanges();
  }
}
