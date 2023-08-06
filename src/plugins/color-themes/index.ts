import { ConfigDefaults, ConfigList } from "./config";
import { hex2rgb, getColorSchemeStyleRule } from "./generate-css";
import "./index.less";
import DSM from "MainController";
import "compile-time-default-color-theme";
import { PluginController } from "plugins/PluginController";

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

function addColor(hex: string, b: number) {
  return rgb2hex(hex2rgb(hex).map((e) => e + b) as [number, number, number]);
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
  static settingsSavedStatesWidget = {
    enabled: true,
    nameKey: "themeName",
    savedStatesKey: "savedStates",
  };

  styles = document.createElement("style");

  constructor(readonly dsm: DSM, public settings: typeof ConfigDefaults) {
    super(dsm, settings);
    console.log("does this run even if disabled?");
  }

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
              scrollbar: this.settings.simpleBackground,
              scrollbarThumb: this.settings.simpleBorder,

              tickerBackground: this.settings.simpleBackground2,

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
  }

  afterEnable() {
    document.body.classList.add("dsm-color-themes-enabled");
    document.head.appendChild(this.styles);
    this.afterConfigChange();
  }

  afterDisable(): void {
    document.body.classList.remove("dsm-color-themes-enabled");
    document.head.removeChild(this.styles);
  }
}
