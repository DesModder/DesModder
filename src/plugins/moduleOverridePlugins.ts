import pinExpressions from "plugins/pin-expressions/moduleOverrides";
import inputTweaks from "plugins/input-tweaks/moduleOverrides";

export interface ModuleOverrides {
  [key: string]: (definition: any, dependencies: string[]) => Function;
}
export const pluginModuleOverrides = {
  ...pinExpressions,
  ...inputTweaks,
} as ModuleOverrides;
