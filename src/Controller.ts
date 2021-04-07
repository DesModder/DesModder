import { isPlugin, Plugin, PluginID } from './plugins'
import View from './View'

export default class Controller {
  menuViewModel = {
    isOpen: false
  }
  pluginsEnabled: {[key: number]: boolean} = {}
  view: View | null = null
  plugins: Plugin[] = []

  constructor () {
    for (let i=0; i < this.plugins.length; i++) {
      this.pluginsEnabled[i] = false
    }
  }

  _registerPlugin(plugin: Plugin) {
    this.plugins.push(plugin)
    const pluginID: PluginID = this.plugins.length - 1
    if (plugin.enabledByDefault) {
      this.enablePlugin(pluginID)
    }
    this.view && this.view.updateMenuView()
    return pluginID
  }

  registerPlugin(plugin: any): (PluginID | undefined) {
    if (isPlugin(plugin)) {
      return this._registerPlugin(plugin)
    }
  }

  init (view: View) {
    this.view = view
    // here want to load config + enabled plugins from local storage + header
  }

  getMenuViewModel () {
    return this.menuViewModel
  }

  updateMenuView () {
    this.view!.updateMenuView()
  }

  toggleMenu () {
    this.menuViewModel.isOpen = !this.menuViewModel.isOpen
    this.updateMenuView()
  }

  closeMenu () {
    this.menuViewModel.isOpen = false
    this.updateMenuView()
  }

  getPlugins () {
    return this.plugins
  }

  disablePlugin (i: number) {
    const plugin = this.plugins[i]
    if (this.pluginsEnabled[i] && plugin.onDisable) {
      plugin.onDisable()
      this.pluginsEnabled[i] = false
      this.updateMenuView()
    }
  }

  enablePlugin (i: PluginID) {
    if (!this.pluginsEnabled[i]) {
      this.plugins[i].onEnable()
      this.pluginsEnabled[i] = true
      this.updateMenuView()
    }
  }

  togglePlugin (i: PluginID) {
    if (this.pluginsEnabled[i]) {
      this.disablePlugin(i)
    } else {
      this.enablePlugin(i)
    }
  }

  isPluginEnabled (i: PluginID) {
    return this.pluginsEnabled[i]
  }

  canTogglePlugin (i: PluginID) {
    return !(this.pluginsEnabled[i] && !('onDisable' in this.plugins[i]))
  }
}
