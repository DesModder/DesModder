export const configList = [
  {
    key: "magnification",
    type: "number",
    default: 1,
    min: 1,
    max: 10,
    step: 0.1,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  magnification: number;
}
