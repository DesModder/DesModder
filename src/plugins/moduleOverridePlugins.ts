import pinExpressions from "plugins/pin-expressions/moduleOverrides";

export interface ModuleOverrides {
  [key: string]: (definition: any, dependencies: string[]) => Function;
}

const _pluginModuleOverrides = {
  "pin-expressions": pinExpressions,
} as const;

export const moduleOverridePluginList = ["pin-expressions"] as const;

export const pluginModuleOverrides = _pluginModuleOverrides as {
  [key in keyof typeof _pluginModuleOverrides]: ModuleOverrides;
};
