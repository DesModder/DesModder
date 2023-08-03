import { PluginController } from "../PluginController";
import { generateBracketPairColorizationCSS } from "./bracket-pair-colorization";
import { Config, configList } from "./config";

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

  afterConfigChange(): void {
    const bpcCss = this.settings.bracketPairColorization
      ? generateBracketPairColorizationCSS(
          this.settings.bracketPairColorizationColors.map((c) => hex2rgb(c)),
          this.settings.bpcColorInText
        )
      : [];

    while ((this.styles.sheet?.cssRules?.length ?? 0) > 0) {
      this.styles.sheet?.deleteRule(0);
    }

    for (const rule of bpcCss) {
      this.styles.sheet?.insertRule(rule);
    }
  }

  afterEnable(): void {
    document.head.appendChild(this.styles);
    this.afterConfigChange();
  }

  afterDisable(): void {
    document.head.removeChild(this.styles);
  }
}
