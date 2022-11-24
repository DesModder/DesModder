export const configList = [
  {
    key: "splitProjects",
    type: "boolean",
    default: false,
  },
  {
    key: "projectName",
    type: "string",
    default: "Desmos Projects",
    variant: "text",
    shouldShow: (config: Config) => !config.splitProjects,
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
  projectName: string;
  secretKey: string;
}
