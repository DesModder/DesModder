export const configList = [
  {
    key: "multilineExpressions",
    type: "boolean",
    default: false,
  },
  {
    key: "compactMode",
    type: "boolean",
    default: false,
  },
] as const;

export interface Config {
  multilineExpressions: boolean;
  compactMode: boolean;
}
