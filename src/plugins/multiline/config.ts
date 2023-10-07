import { ConfigItem } from "#plugins/index.ts";

export const configList = [
  {
    type: "boolean",
    default: true,
    key: "determineLineBreaksAutomatically",
  },
  {
    indentationLevel: 1,
    type: "number",
    default: 30,
    min: 0,
    max: Infinity,
    step: 1,
    key: "widthBeforeMultiline",
    shouldShow(current) {
      return current.determineLineBreaksAutomatically;
    },
  },
  {
    indentationLevel: 1,
    type: "boolean",
    default: true,
    key: "disableAutomaticLineBreaksForHandAlignedExpressions",
    shouldShow(current) {
      return current.determineLineBreaksAutomatically;
    },
  },
  {
    indentationLevel: 1,
    type: "boolean",
    default: true,
    key: "automaticallyMultilinify",

    shouldShow(current) {
      return current.determineLineBreaksAutomatically;
    },
  },
  {
    indentationLevel: 2,
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
