import { ConfigItem } from "#plugins/index.ts";

export const configList = [
  {
    type: "boolean",
    key: "bracketPairColorization",
    default: true,
  },
  {
    type: "color-list",
    key: "bracketPairColorizationColors",
    default: ["#000000", "#369646", "#6042a6", "#a03f21"],
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
    max: 10,
    step: 1,
    default: 0,
    key: "thickenBrackets",
    shouldShow: (config) => config.bracketPairColorization,
  },
  {
    type: "boolean",
    key: "highlightBracketBlocks",
    default: true,
  },
  {
    type: "boolean",
    key: "highlightBracketBlocksHover",
    default: false,
  },
  {
    type: "boolean",
    key: "underlineHighlightedRanges",
    default: false,
    shouldShow: (config) =>
      config.highlightBracketBlocks || config.highlightBracketBlocksHover,
  },
] satisfies readonly ConfigItem[];

export interface Config {
  bracketPairColorizationColors: string[];
  bracketPairColorization: boolean;
  bpcColorInText: boolean;
  thickenBrackets: number;
  highlightBracketBlocks: boolean;
  highlightBracketBlocksHover: boolean;
  underlineHighlightedRanges: boolean;
}
