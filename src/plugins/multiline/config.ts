import { ConfigItem } from "plugins";

export const configList = [
  {
    type: "number",
    default: 300,
    min: 0,
    max: Infinity,
    step: 0.001,
    key: "widthBeforeMultiline",
  },
  {
    type: "boolean",
    default: true,
    key: "automaticallyMultilinify",
  },
  {
    type: "number",
    default: 1000,
    min: 0,
    max: Infinity,
    step: 0.001,
    key: "multilinifyDelayAfterEdit",
    shouldShow(current) {
      return current.automaticallyMultilinify;
    },
  },
] satisfies ConfigItem[];

export interface Config {
  widthBeforeMultiline: number;
  automaticallyMultilinify: boolean;
  multilinifyDelayAfterEdit: number;
}
