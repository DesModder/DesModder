import { ConfigItem } from "#plugins/index.ts";

export const configList = [
  {
    type: "number",
    default: 30,
    min: 0,
    max: Infinity,
    step: 1,
    key: "widthBeforeMultiline",
  },
  {
    type: "boolean",
    default: true,
    key: "determineLineBreaksAutomatically",
  },
  {
    type: "boolean",
    default: true,
    key: "disableAutomaticLineBreaksForHandAlignedExpressions",
    shouldShow(current) {
      return current.determineLineBreaksAutomatically;
    },
  },
  {
    type: "boolean",
    default: true,
    key: "automaticallyMultilinify",

    shouldShow(current) {
      return current.determineLineBreaksAutomatically;
    },
  },
  {
    type: "number",
    default: 1000,
    min: 0,
    max: Infinity,
    step: 1,
    key: "multilinifyDelayAfterEdit",
    shouldShow(current) {
      return (
        current.automaticallyMultilinify &&
        current.determineLineBreaksAutomatically
      );
    },
  },
  {
    type: "boolean",
    default: true,
    key: "spacesToNewlines",
  },
] satisfies ConfigItem[];

export interface Config {
  widthBeforeMultiline: number;
  automaticallyMultilinify: boolean;
  determineLineBreaksAutomatically: boolean;
  multilinifyDelayAfterEdit: number;
  spacesToNewlines: boolean;
  disableAutomaticLineBreaksForHandAlignedExpressions: boolean;
}
