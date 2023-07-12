import { ConfigItem } from "plugins";

export const configList = [
  {
    key: "superscriptOperators",
    type: "boolean",
    default: false,
  },
  {
    key: "commaDelimeter",
    type: "boolean",
    default: false,
  },
  {
    key: "delimeterOverride",
    type: "string",
    variant: "text",
    default: ",",
    shouldShow(current) {
      return current.commaDelimeter;
    },
  },
  {
    key: "extendedGreek",
    type: "boolean",
    default: false,
  },
  {
    key: "subscriptReplacements",
    type: "boolean",
    default: false,
  },
  {
    key: "noAutoSubscript",
    type: "boolean",
    default: false,
  },
  {
    key: "noNEquals",
    type: "boolean",
    default: false,
  },
  {
    key: "leftIntoSubscript",
    type: "boolean",
    default: false,
  },
  {
    key: "subSupWithoutOp",
    type: "boolean",
    default: false,
  },
  {
    key: "allowMixedBrackets",
    type: "boolean",
    default: false,
  },
  {
    key: "noPercentOf",
    type: "boolean",
    default: false,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] satisfies ConfigItem[];

export interface Config {
  superscriptOperators: boolean;
  commaDelimeter: boolean;
  delimeterOverride: string;
  extendedGreek: boolean;
  subscriptReplacements: boolean;
  noAutoSubscript: boolean;
  noNEquals: boolean;
  leftIntoSubscript: boolean;
  subSupWithoutOp: boolean;
  allowMixedBrackets: boolean;
  noPercentOf: boolean;
}
