export const configList = [
  {
    key: "reciprocalExponents2Surds",
    name: "Radical Notation",
    description: "Converts fractional powers less than one to a radical equivalent (surd)",
    type: "boolean",
    default: false,
  },
  {
    key: "derivativeLoopLimit",
    name: "Expand Derivatives",
    description: "Expands the nth derivative of Leibniz notation into repeated derivatives (limited to 10).",
    type: "boolean",
    default: true,
  }
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  reciprocalExponents2Surds: boolean;
  derivativeLoopLimit: boolean;
}
