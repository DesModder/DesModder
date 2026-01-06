import { ConfigItem } from "#plugins/index.ts";

export const configList: ConfigItem[] = [
  {
    key: "showWidth",
    type: "boolean",
    default: true,
  },
  {
    key: "disableOnReload",
    type: "boolean",
    default: false,
  },
];

export interface Config {
  showWidth: boolean;
  disableOnReload: boolean;
}
