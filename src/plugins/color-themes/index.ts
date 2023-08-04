import { Config, ConfigList } from "./config";
import "./index.less";
import { PluginController } from "plugins/PluginController";

function hex2rgb(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgb2hex(rgb: [number, number, number]) {
  return "#" + rgb.map((e) => e.toString(16).padStart(2, "0")).join("");
}

export default class ColorThemes extends PluginController<Config> {
  static config = ConfigList;
  static id = "color-themes" as const;
  static enabledByDefault = true;

  styles = document.createElement("style");

  afterConfigChange(): void {
    while ((this.styles.sheet?.cssRules?.length ?? 0) > 0) {
      this.styles.sheet?.deleteRule(0);
    }

    this.styles.sheet?.insertRule(`
        :root {
            --dsm-background: ${this.settings.background};
            --dsm-background-rgb: ${hex2rgb(this.settings.background)};
            --dsm-foreground: ${this.settings.foreground};
            --dsm-foreground-rgb: ${hex2rgb(this.settings.foreground)};
            --dsm-pillbox-button-background: ${
              this.settings.pillboxButtonBackground
            };
            --dsm-expr-top-bar-background-1: ${
              this.settings.exprTopBarBackground1
            };
            --dsm-expr-top-bar-background-2: ${
              this.settings.exprTopBarBackground2
            };
            --dsm-exppanel-dragger-background: ${
              this.settings.exppanelDraggerBackground
            };
            --dsm-error: ${this.settings.error};
            --dsm-desmodder-menu-title: ${this.settings.desmodderMenuTitle};
            --dsm-desmodder-menu-description: ${
              this.settings.desmodderMenuDescription
            };
            --dsm-desmodder-input-border: ${this.settings.desmodderInputBorder};
            --dsm-exppanel-border-rgb: ${hex2rgb(this.settings.exppanelBorder)};
            --dsm-keypad-background: ${this.settings.keypadBackground};
            --dsm-keypad-light-button-background-1: ${
              this.settings.keypadLightButtonBackground1
            };
            --dsm-keypad-light-button-background-2: ${
              this.settings.keypadLightButtonBackground2
            };
            --dsm-keypad-light-gray-button-background-1: ${
              this.settings.keypadLightGrayButtonBackground1
            };
            --dsm-keypad-light-gray-button-background-2: ${
              this.settings.keypadLightGrayButtonBackground2
            };
            --dsm-keypad-function-menu-section-heading: ${
              this.settings.keypadFunctionMenuSectionHeading
            };
        }
    `);
  }

  afterEnable() {
    document.head.appendChild(this.styles);
    this.afterConfigChange();
  }
}
