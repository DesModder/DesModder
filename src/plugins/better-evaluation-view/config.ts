import { ConfigItem } from "#plugins/index.ts";

export type ListOptions = "old" | "new" | "length";
export type ColorModelOptions = "rgb" | "hsv" | "hex";

export const configList: ConfigItem[] = [
  {
    key: "floats",
    type: "boolean",
    default: false,
  },
  {
    key: "lists",
    type: "segmented-options",
    options: [
      { name: "new", i18nKey: "better-evaluation-view-opt-lists-new" },
      { name: "old", i18nKey: "better-evaluation-view-opt-lists-old" },
      { name: "length", i18nKey: "better-evaluation-view-opt-lists-length" },
    ],
    default: "new",
  },
  {
    key: "colors",
    type: "boolean",
    default: true,
  },
  {
    key: "colorLists",
    type: "boolean",
    default: true,
    shouldShow: (current: Config) => current.lists === "old" && current.colors,
  },
  {
    key: "colorModel",
    type: "segmented-options",
    options: [
      { name: "rgb", i18nKey: "better-evaluation-view-opt-colorModel-rgb" },
      { name: "hsv", i18nKey: "better-evaluation-view-opt-colorModel-hsv" },
      { name: "hex", i18nKey: "better-evaluation-view-opt-colorModel-hex" },
    ],
    default: "rgb",
    shouldShow: (current: Config) => current.colors,
  },
];

export interface Config {
  floats: boolean;
  lists: ListOptions;
  colors: boolean;
  colorLists: boolean;
  colorModel: ColorModelOptions;
}
