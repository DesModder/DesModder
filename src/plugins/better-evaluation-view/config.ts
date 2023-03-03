import { ConfigItem } from "plugins";

export const configList: ConfigItem[] = [
  {
    key: "lists",
    type: "boolean",
    default: true,
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
  lists: boolean;
  colors: boolean;
}
