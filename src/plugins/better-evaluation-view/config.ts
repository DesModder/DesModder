import { ConfigItem } from "#plugins/index.ts";

export type ListOptions = "old" | "new" | "length";

export const configList: ConfigItem[] = [
  {
    key: "floats",
    type: "boolean",
    default: false,
  },
  {
    key: "lists",
    type: "segmented-options",
    options: ["old", "new", "length"],
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
    shouldShow: (current: Config) =>
      current.lists != "length" && current.colors,
  },
];

export interface Config {
  floats: boolean;
  lists: ListOptions;
  colors: boolean;
  colorLists: boolean;
}
