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
    default: ["#C06000", "#00C060", "#6000C0"],
    shouldShow: (config) => config.bracketPairColorization,
  },
  {
    type: "boolean",
    key: "bpcColorInText",
    default: false,
    shouldShow: (config) => config.bracketPairColorization,
  },
] satisfies readonly ConfigItem[];

export interface Config {
  bracketPairColorizationColors: string[];
  bracketPairColorization: boolean;
  bpcColorInText: boolean;
}
