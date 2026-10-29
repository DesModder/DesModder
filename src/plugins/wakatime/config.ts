import { ConfigItem } from "..";

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
    key: "appId",
    type: "string",
    variant: "password",
    default: "",
  },
  {
    key: "appSecret",
    type: "string",
    variant: "password",
    default: "",
  },
  {
    key: "authorize",
    type: "button",
    behavior: "redirect",
    getUrl: (clientId: string) =>
      `https://wakatime.com/oauth/authorize?client_id=${clientId}&response_type=token&scope=write_heartbeats&redirect_uri=https%3A%2F%2Fwww.desmos.com%2Fcalculator`,
    shouldShow: (config: Config) => !!config.appId && !!config.appSecret,
  },
  {
    key: "notifyRefresh",
    type: "boolean",
    default: false,
    shouldShow: (config: Config) => !!config.appId && !!config.appSecret,
  },
  {
    key: "accessToken",
    type: "string",
    variant: "password",
    default: "",
    shouldShow: (config: Config) =>
      config.notifyRefresh && !!config.appId && !!config.appSecret,
  },
  {
    key: "refreshToken",
    type: "string",
    variant: "password",
    default: "",
    shouldShow: (config: Config) =>
      config.notifyRefresh && !!config.appId && !!config.appSecret,
  },
  {
    key: "expiresAt",
    type: "number",
    variant: "number",
    default: 0,
    min: 0,
    max: 8640000000000000, // One millisecond beyond this becomes an invalid date
    step: 1,
    shouldShow: (config: Config) =>
      config.notifyRefresh && !!config.appId && !!config.appSecret,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const satisfies ConfigItem[];

export interface Config {
  splitProjects: boolean;
  projectName: string;
  appId: string;
  appSecret: string;
  notifyRefresh: boolean;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
