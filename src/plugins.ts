import duplicateHotkey from 'plugins/duplicateHotkey'
import findReplace from 'plugins/find-replace/index'
import wolfram2desmos from 'plugins/wolfram2desmos'

interface Plugin {
  name: string,
  description: string,
  onEnable(): void,
  onDisable?(): void,
  enabledByDefault: boolean
}

// these plugins will be listed in list order in the menu
export default [
  duplicateHotkey,
  findReplace,
  wolfram2desmos
] as ReadonlyArray<Plugin>
