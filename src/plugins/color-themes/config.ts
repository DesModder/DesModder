import { ConfigItem } from "plugins";

export const ConfigList = [
  {
    type: "string",
    variant: "color",
    default: "#000000",
    key: "foreground",
  },
  {
    type: "string",
    variant: "color",
    default: "#ffffff",
    key: "background",
  },
  {
    type: "string",
    variant: "color",
    default: "#ededed",
    key: "pillboxButtonBackground",
  },
  {
    type: "string",
    variant: "color",
    default: "#fcfcfc",
    key: "exprTopBarBackground1",
  },
  {
    type: "string",
    variant: "color",
    default: "#eaeaea",
    key: "exprTopBarBackground2",
  },
  {
    type: "string",
    variant: "color",
    default: "#eeeeee",
    key: "exppanelDraggerBackground",
  },
  {
    type: "string",
    variant: "color",
    default: "#CECECE",
    key: "exppanelBorder",
  },
  {
    type: "string",
    variant: "color",
    default: "#e66b3c",
    key: "error",
  },
  {
    type: "string",
    variant: "color",
    default: "#222222",
    key: "desmodderMenuTitle",
  },
  {
    type: "string",
    variant: "color",
    default: "#444444",
    key: "desmodderMenuDescription",
  },
  {
    type: "string",
    variant: "color",
    default: "#aaaaaa",
    key: "desmodderInputBorder",
  },
  {
    type: "string",
    variant: "color",
    default: "#ededed",
    key: "keypadBackground",
  },
  {
    type: "string",
    variant: "color",
    default: "#ffffff",
    key: "keypadLightButtonBackground1",
  },
  {
    type: "string",
    variant: "color",
    default: "#fafafa",
    key: "keypadLightButtonBackground2",
  },
  {
    type: "string",
    variant: "color",
    default: "#f6f6f6",
    key: "keypadLightGrayButtonBackground1",
  },
  {
    type: "string",
    variant: "color",
    default: "#f0f0f0",
    key: "keypadLightGrayButtonBackground2",
  },
  {
    type: "string",
    variant: "color",
    default: "#666666",
    key: "keypadFunctionMenuSectionHeading",
  },
] satisfies ConfigItem[];

export interface Config {
  foreground: string;
  background: string;
  pillboxButtonBackground: string;
  exprTopBarBackground1: string;
  exprTopBarBackground2: string;
  exppanelDraggerBackground: string;
  error: string;
  desmodderMenuTitle: string;
  desmodderMenuDescription: string;
  desmodderInputBorder: string;
  exppanelBorder: string;
  keypadBackground: string;
  keypadLightButtonBackground1: string;
  keypadLightButtonBackground2: string;
  keypadLightGrayButtonBackground1: string;
  keypadLightGrayButtonBackground2: string;
  keypadFunctionMenuSectionHeading: string;
}
