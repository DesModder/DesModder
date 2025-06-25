export const configList = [
  {
    key: "magnification",
    type: "number",
    default: 3,
    min: 1,
    max: 30,
    step: 0.1,
  },
] as const;

export interface Config {
  magnification: number;
}
