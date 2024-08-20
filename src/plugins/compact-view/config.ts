import { ConfigItem } from "#plugins/index.ts";

export const configList = [
  {
    type: "number",
    min: 0,
    max: 1,
    step: 0.001,
    default: 1,
    key: "compactFactor",
    variant: "range",
  },
  {
    type: "boolean",
    key: "hideFolderToggles",
    default: true,
    shouldShow: (_, dsm): boolean =>
      // The official API doesn't have `advancedStyling` and `authorFeatures`,
      // and it would be a hassle to copy over the typing for the extra two fields.
      (dsm.calc.settings as any).advancedStyling ||
      (dsm.calc.settings as any).authorFeatures,
  },
  {
    type: "boolean",
    key: "noSeparatingLines",
    default: false,
  },
  {
    type: "boolean",
    key: "highlightAlternatingLines",
    default: true,
    shouldShow: (config) => config.noSeparatingLines,
  },
  {
    type: "boolean",
    key: "hideEvaluations",
    default: false,
  },
  {
    type: "number",
    key: "textFontSize",
    default: 16,
    min: 0,
    max: 100,
    step: 1,
  },
  {
    type: "number",
    key: "mathFontSize",
    default: 18,
    min: 0,
    max: 100,
    step: 1,
  },
  {
    type: "number",
    key: "bracketFontSizeFactor",
    default: 1,
    min: 0,
    max: 1,
    step: 0.001,
  },
  {
    type: "number",
    key: "minimumFontSize",
    default: 10,
    min: 0,
    max: 100,
    step: 1,
    shouldShow: (config) => config.bracketFontSizeFactor !== 1,
  },
] satisfies readonly ConfigItem[];

export interface Config {
  textFontSize: number;
  mathFontSize: number;
  bracketFontSizeFactor: number;
  minimumFontSize: number;
  noSeparatingLines: boolean;
  highlightAlternatingLines: boolean;
  compactFactor: number;
  hideEvaluations: boolean;
  hideFolderToggles: boolean;
}
