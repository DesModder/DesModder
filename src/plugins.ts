import duplicateHotkey from 'plugins/duplicateHotkey'
import findReplace from 'plugins/find-replace/index'
import wolfram2desmos from 'plugins/wolfram2desmos'

export interface Plugin {
  name: string,
  description: string,
  onEnable(): void,
  onDisable?(): void,
  enabledByDefault: boolean
}

export function isPlugin(obj: any): obj is Plugin {
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.onEnable === 'function' &&
    (!obj.onDisable || typeof obj.onDisable === 'function') &&
    typeof obj.enabledByDefault === 'boolean'
  )
}

export type PluginID = number

// these plugins will be listed in list order in the menu
export default [
  duplicateHotkey,
  findReplace,
  wolfram2desmos
] as ReadonlyArray<Plugin>
