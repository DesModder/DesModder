export const configList = [
  {
    key: "splitProjects",
    type: "boolean",
    default: false,
  },
  {
    key: "secretKey",
    type: "string",
    variant: "password",
    default: "",
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  splitProjects: boolean;
  secretKey: string;
}
