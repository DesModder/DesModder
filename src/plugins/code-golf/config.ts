import { ConfigItem } from "#plugins/index.ts";

export const configList: ConfigItem[] = [
  {
    key: "showWidth",
    type: "boolean",
    default: true,
  },
];

export interface Config {
  showWidth: boolean;
}
