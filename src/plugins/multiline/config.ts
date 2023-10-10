import { ConfigItem } from "#plugins/index.ts";

export const configList = [
  {
    type: "boolean",
    default: true,
    key: "autoInsertLinebreaks",
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
      return current.autoInsertLinebreaks;
    },
  },
  {
    indentationLevel: 1,
    type: "boolean",
    default: true,
    key: "disableAutomaticLineBreaksForHandAlignedExpressions",
    shouldShow(current) {
      return current.autoInsertLinebreaks;
    },
  },
  {
    type: "boolean",
    default: true,
    key: "spacesToNewlines",
  },
  {
    indentationLevel: 1,
    type: "boolean",
    default: true,
    key: "autoAlignGrids",
    shouldShow(current) {
      return current.spacesToNewlines;
    },
  },
  {
    indentationLevel: 2,
    type: "number",
    default: 3000,
    min: 0,
    max: Infinity,
    step: 1,
    key: "maxAutoAlignExpressionSize",
    shouldShow(current) {
      return current.spacesToNewlines && current.autoAlignGrids;
    },
  },
  {
    indentationLevel: 0,
    type: "boolean",
    default: true,
    key: "alterLayoutWhileTyping",

    shouldShow(current) {
      return current.autoInsertLinebreaks || current.autoAlignGrids;
    },
  },
  {
    indentationLevel: 1,
    type: "number",
    default: 1000,
    min: 0,
    max: Infinity,
    step: 1,
    key: "multilinifyDelayAfterEdit",
    shouldShow(current) {
      return (
        current.alterLayoutWhileTyping &&
        (current.autoInsertLinebreaks || current.autoAlignGrids)
      );
    },
  },
] satisfies ConfigItem[];

export interface Config {
  widthBeforeMultiline: number;
  alterLayoutWhileTyping: boolean;
  autoInsertLinebreaks: boolean;
  multilinifyDelayAfterEdit: number;
  spacesToNewlines: boolean;
  disableAutomaticLineBreaksForHandAlignedExpressions: boolean;
  autoAlignGrids: boolean;
  maxAutoAlignExpressionSize: number;
}
