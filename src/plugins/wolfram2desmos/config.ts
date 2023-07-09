export const configList = [
  {
    key: "reciprocalExponents2Surds",
    type: "boolean",
    default: false,
  },
  {
    key: "derivativeLoopLimit",
    type: "boolean",
    default: true,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  reciprocalExponents2Surds: boolean;
  derivativeLoopLimit: boolean;
}
