export const ConfigDefaultsAdvanced = {
  // =================== ADVANCED MODE ===================

  // general
  foreground: "#000000",
  background: "#ffffff",
  pillboxButtonBackground: "#ededed",
  sectionHeading: "#666666",
  checkboxLabel: "#333333",
  caretIcon: "#999999",
  scrollbar: "#ffffff",
  scrollbarThumb: "#999999",

  // ticker panel
  tickerBackground: "#eeeeee",

  // exppanel
  exppanelDraggerBackground: "#eeeeee",
  error: "#e66b3c",
  exppanelBorder: "#cecece",

  // exppanel top
  exprTopBarBackground1: "#fcfcfc",
  exprTopBarBackground2: "#eaeaea",
  redButtonBackground: "#ce4945",
  redButtonBorder: "#aa3a37",
  buttonText: "#ffffff",

  // expression settings menu
  expressionSettingsBorder: "#d3d3d3",

  // settings
  settingsMenuSeparator: "#dddddd",
  settingsAxisLabelLabelColor: "#666666",
  settingsAxisLabelInputColor: "#666666",

  // tooltips
  tooltipBackground: "#000000",
  tooltipForeground: "#ffffff",

  // toggles
  toggleSwitch: "#666666",
  toggleView: "#dddddd",

  // desmodder menu
  desmodderMenuTitle: "#222222",
  desmodderMenuDescription: "#444444",
  desmodderInputBorder: "#aaaaaa",
  desmodderCategorySeparator: "#e2e2e2",

  // keypad
  keypadBackground: "#ededed",
  keypadLightButtonBackground1: "#ffffff",
  keypadLightButtonBackground2: "#fafafa",
  keypadLightButtonBorder: "#d8d8d8",
  keypadLightGrayButtonBackground1: "#f6f6f6",
  keypadLightGrayButtonBackground2: "#f0f0f0",
  keypadDarkButtonBorder: "#bbbbbb",

  // modals
  modalForeground: "#444444",
};

export function hex2rgb(hex: string) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function colorToRule(key: string, hex: string) {
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

export function getColorSchemeStyleRule(
  settings: typeof ConfigDefaultsAdvanced
) {
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
