export const configList = [
  {
    key: "multiplier",
    type: "number",
    default: 1.0,
    min: 0.1,
    max: 10,
    step: 0.1,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  multiplier: number;
}
