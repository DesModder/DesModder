import {
  ConfigDefaults,
  ConfigDefaultsAdvanced,
  ConfigDefaultsColors,
  ConfigList,
} from "./config";
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
  return (
    "#" +
    rgb
      .map((e) =>
        Math.min(Math.max(Math.round(e), 0), 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function colorToRule(key: string, hex: string) {
  const rgb = hex2rgb(hex);

  let kebabCase = "";
  for (const char of key) {
    if (char.toUpperCase() === char) {
      kebabCase += "-" + char.toLowerCase();
    } else {
      kebabCase += char;
    }
  }

  return `--dsm-${kebabCase}: ${hex};\n--dsm-${kebabCase}-rgb: ${rgb};\n`;
}

function multiplyColor(hex: string, factor: number) {
  return rgb2hex(
    hex2rgb(hex).map((e) => e * factor) as [number, number, number]
  );
}

function addColor(hex: string, b: number) {
  return rgb2hex(hex2rgb(hex).map((e) => e + b) as [number, number, number]);
}

function getColorSchemeStyleRule(settings: typeof ConfigDefaultsAdvanced) {
  return `
    :root {
        ${Object.keys(ConfigDefaultsAdvanced)
          .map((k) =>
            colorToRule(k, settings[k as keyof typeof ConfigDefaultsAdvanced])
          )
          .join("")}
    }
`;
}

export default class ColorThemes extends PluginController<
  typeof ConfigDefaults
> {
  static config = ConfigList;
  static id = "color-themes" as const;
  static enabledByDefault = true;
  static hasSettingsImportExportWidget = true;
  static settingsImportWidgetData = {
    copyToClipboardButton: "color-themes-copy-to-clipboard",
    importButton: "color-themes-import",
  };

  styles = document.createElement("style");

  afterConfigChange(): void {
    while ((this.styles.sheet?.cssRules?.length ?? 0) > 0) {
      this.styles.sheet?.deleteRule(0);
    }

    this.styles.sheet?.insertRule(
      getColorSchemeStyleRule(
        this.settings.advancedModeEnabled
          ? this.settings
          : {
              foreground: this.settings.simpleForeground,
              background: this.settings.simpleBackground,
              pillboxButtonBackground: this.settings.simpleButtonGray,
              sectionHeading: this.settings.simpleForeground,
              checkboxLabel: this.settings.simpleForeground,
              caretIcon: this.settings.simpleToggleSwitch,

              expressionSettingsBorder: this.settings.simpleBorder,
              exppanelDraggerBackground: this.settings.simpleBackground2,
              error: "#e66b3c",
              exppanelBorder: this.settings.simpleBorder,

              exprTopBarBackground1: addColor(
                this.settings.simpleBackground2,
                -10
              ),
              exprTopBarBackground2: this.settings.simpleBackground2,
              redButtonBackground: "#ce4945",
              redButtonBorder: "#aa3a37",
              buttonText: "#ffffff",

              settingsMenuSeparator: this.settings.simpleBorder,
              settingsAxisLabelLabelColor: this.settings.simpleForeground,
              settingsAxisLabelInputColor: this.settings.simpleForeground,

              tooltipBackground: this.settings.simpleForeground,
              tooltipForeground: this.settings.simpleBackground,

              toggleSwitch: this.settings.simpleToggleSwitch,
              toggleView: this.settings.simpleToggleView,

              desmodderMenuTitle: this.settings.simpleForeground,
              desmodderMenuDescription: this.settings.simpleForeground,
              desmodderInputBorder: this.settings.simpleBorder,
              desmodderCategorySeparator: this.settings.simpleBorder,

              keypadBackground: this.settings.simpleBackground2,
              keypadLightButtonBackground1: this.settings.simpleButtonLight,
              keypadLightButtonBackground2: addColor(
                this.settings.simpleButtonLight,
                -10
              ),
              keypadLightGrayButtonBackground1: this.settings.simpleButtonGray,
              keypadLightGrayButtonBackground2: addColor(
                this.settings.simpleButtonGray,
                -10
              ),
              keypadLightButtonBorder: this.settings.simpleBorder,
              keypadDarkButtonBorder: this.settings.simpleBorder,
            }
      )
    );

    // this.styles.sheet?.insertRule(`
    //     :root {
    //         --dsm-background: ${this.settings.background};
    //         --dsm-background-rgb: ${hex2rgb(this.settings.background)};
    //         --dsm-foreground: ${this.settings.foreground};
    //         --dsm-foreground-rgb: ${hex2rgb(this.settings.foreground)};
    //         --dsm-pillbox-button-background: ${
    //           this.settings.pillboxButtonBackground
    //         };
    //         --dsm-expr-top-bar-background-1: ${
    //           this.settings.exprTopBarBackground1
    //         };
    //         --dsm-expr-top-bar-background-2: ${
    //           this.settings.exprTopBarBackground2
    //         };
    //         --dsm-exppanel-dragger-background: ${
    //           this.settings.exppanelDraggerBackground
    //         };
    //         --dsm-error: ${this.settings.error};
    //         --dsm-desmodder-menu-title: ${this.settings.desmodderMenuTitle};
    //         --dsm-desmodder-menu-description: ${
    //           this.settings.desmodderMenuDescription
    //         };
    //         --dsm-desmodder-input-border: ${this.settings.desmodderInputBorder};
    //         --dsm-exppanel-border-rgb: ${hex2rgb(this.settings.exppanelBorder)};
    //         --dsm-keypad-background: ${this.settings.keypadBackground};
    //         --dsm-keypad-light-button-background-1: ${
    //           this.settings.keypadLightButtonBackground1
    //         };
    //         --dsm-keypad-light-button-background-2: ${
    //           this.settings.keypadLightButtonBackground2
    //         };
    //         --dsm-keypad-light-gray-button-background-1: ${
    //           this.settings.keypadLightGrayButtonBackground1
    //         };
    //         --dsm-keypad-light-gray-button-background-2: ${
    //           this.settings.keypadLightGrayButtonBackground2
    //         };
    //         --dsm-keypad-function-menu-section-heading: ${
    //           this.settings.keypadFunctionMenuSectionHeading
    //         };
    //     }
    // `);
  }

  afterEnable() {
    document.head.appendChild(this.styles);
    this.afterConfigChange();
  }
}
