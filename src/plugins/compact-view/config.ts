import { ConfigItem } from "plugins";

export const configList = [
  {
    type: "number",
    key: "textFontSize",
    default: 12,
    min: 0,
    max: 100,
    step: 0.001,
  },
  {
    type: "number",
    key: "mathFontSize",
    default: 14,
    min: 0,
    max: 100,
    step: 0.001,
  },
  {
    type: "number",
    key: "bracketFontSizeFactor",
    default: 0.9,
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
    step: 0.001,
  },
  {
    type: "boolean",
    key: "removeSpacing",
    default: true,
  },
] satisfies readonly ConfigItem[];

export interface Config {
  textFontSize: number;
  mathFontSize: number;
  bracketFontSizeFactor: number;
  minimumFontSize: number;
  removeSpacing: boolean;
}
