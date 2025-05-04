import { ConfigItem } from "#plugins/index.ts";

export const configList: ConfigItem[] = [
  {
    key: "floats",
    type: "boolean",
    default: false,
  },
  {
    key: "lists",
    type: "boolean",
    default: false,
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
    shouldShow: (current: Config) => current.lists && current.colors,
  },
];

export interface Config {
  floats: boolean;
  lists: boolean;
  colors: boolean;
  colorLists: boolean;
}
