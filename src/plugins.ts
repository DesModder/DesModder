import duplicateHotkey from "plugins/duplicateHotkey";
import findReplace from "plugins/find-replace/index";
import wolfram2desmos from "plugins/wolfram2desmos";
import videoCreator from "plugins/video-creator/index";
import builtinSettings from "plugins/builtin-settings/index";

interface ConfigItemGeneric {
  key: string;
  name: string;
  description?: string;
}

interface ConfigItemBoolean extends ConfigItemGeneric {
  type: "boolean";
  default: boolean;
}

type ConfigItem = ConfigItemBoolean;

type GenericBooleanObject = { [key: string]: boolean };

export interface Plugin {
  name: string;
  description: string;
  onEnable(config?: unknown): void;
  onDisable?(): void;
  enabledByDefault: boolean;
  config?: ConfigItem[];
  onConfigChange?(changes: GenericBooleanObject): void;
  manageConfigChange?(
    current: GenericBooleanObject,
    next: GenericBooleanObject
  ): GenericBooleanObject;
}

export function isPlugin(obj: any): obj is Plugin {
  return (
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    typeof obj.onEnable === "function" &&
    (!obj.onDisable || typeof obj.onDisable === "function") &&
    typeof obj.enabledByDefault === "boolean"
  );
}

export type PluginID = number;

// these plugins will be listed in list order in the menu
// place closer to the top: plugins that people are more likely to adjust
export default [
  builtinSettings,
  videoCreator,
  duplicateHotkey,
  findReplace,
  wolfram2desmos,
] as ReadonlyArray<Plugin>;
