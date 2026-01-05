export const configList = [
  {
    key: "dollyMagnification",
    type: "number",
    default: 3,
    min: 1,
    max: 30,
    step: 0.1,
  },
  {
    key: "scalarZoomed",
    type: "number",
    default: 1,
    min: 1,
    max: 30,
    step: 0.1,
  },
] as const;

export interface Config {
  dollyMagnification: number;
  scalarZoomed: number;
}
