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

export function toggleRules(rules: string[], toggle: boolean) {
  return toggle ? rules : [];
}

export default class SyntaxHighlighting extends PluginController<Config> {
  static id = "syntax-highlighting" as const;
  static enabledByDefault = false;
  static config = configList;

  styles = document.createElement("style");

  caretBracketContainer: HTMLElement | null = null;
  mouseBracketContainer: HTMLElement | null = null;

  afterConfigChange(): void {
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
  }

  onMouseOver = (e: MouseEvent) => {
    const el = e.target;

    if (!(el instanceof Element)) return;

    const closestMQBC = el.closest(".dcg-mq-bracket-container");

    delete this.mouseBracketContainer?.dataset.isDirectlyHovered;
    this.mouseBracketContainer = closestMQBC as HTMLElement | null;
    if (this.mouseBracketContainer)
      this.mouseBracketContainer.dataset.isDirectlyHovered = "true";
  };

  afterEnable(): void {
    document.head.appendChild(this.styles);
    this.afterConfigChange();

    setInterval(() => {
      const cursor = document.querySelector(".dcg-mq-cursor");
      if (cursor) {
        const oldcaretBracketContainer = this.caretBracketContainer;
        this.caretBracketContainer = cursor.closest(
          ".dcg-mq-bracket-container"
        );

        if (oldcaretBracketContainer !== this.caretBracketContainer) {
          if (oldcaretBracketContainer)
            delete oldcaretBracketContainer.dataset.containsCaret;
          if (this.caretBracketContainer)
            this.caretBracketContainer.dataset.containsCaret = "true";
        }
      }
    });

    document.addEventListener("mouseover", this.onMouseOver);
  }

  afterDisable(): void {
    document.head.removeChild(this.styles);
    document.removeEventListener("mouseover", this.onMouseOver);
  }
}
