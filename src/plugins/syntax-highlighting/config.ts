import { ConfigItem } from "plugins";

export const configList = [
  {
    type: "boolean",
    key: "bracketPairColorization",
    default: true,
  },
  {
    type: "color-list",
    key: "bracketPairColorizationColors",
    default: ["#000000", "#fb9937", "#4e886b", "#d34545", "#652c8c"],
    shouldShow: (config) => config.bracketPairColorization,
  },
  {
    type: "boolean",
    key: "bpcColorInText",
    default: false,
    shouldShow: (config) => config.bracketPairColorization,
  },
  {
    type: "number",
    variant: "range",
    min: 0,
    max: 20,
    step: 1,
    default: 5,
    key: "thickenBrackets",
    shouldShow: (config) => config.bracketPairColorization,
  },
  {
    type: "boolean",
    key: "highlightBracketBlocks",
    default: true,
  },
] satisfies readonly ConfigItem[];

export interface Config {
  bracketPairColorizationColors: string[];
  bracketPairColorization: boolean;
  bpcColorInText: boolean;
  thickenBrackets: number;
  highlightBracketBlocks: boolean;
}
