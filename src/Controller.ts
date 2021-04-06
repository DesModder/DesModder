import plugins from './plugins'
import View from './View'

export default class Controller {
  menuViewModel = {
    isOpen: false
  }
  pluginsEnabled: {[key: number]: boolean} = {}
  view: View | null = null

  constructor () {
    for (let i=0; i<plugins.length; i++) {
      this.pluginsEnabled[i] = false
    }
  }

  init (view: View) {
    this.view = view
    // here will load enabled plugins from local storage + header
    plugins.forEach((plugin, i) => {
      if (plugin.enabledByDefault) {
        this.enablePlugin(i)
      }
    })
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
    // This is constant between page loads
    return plugins
  }

  disablePlugin (i: number) {
    const plugin = plugins[i]
    if (this.pluginsEnabled[i] && plugin.onDisable) {
      plugin.onDisable()
      this.pluginsEnabled[i] = false
      this.updateMenuView()
    }
  }

  enablePlugin (i: number) {
    if (!this.pluginsEnabled[i]) {
      plugins[i].onEnable()
      this.pluginsEnabled[i] = true
      this.updateMenuView()
    }
  }

  togglePlugin (i: number) {
    if (this.pluginsEnabled[i]) {
      this.disablePlugin(i)
    } else {
      this.enablePlugin(i)
    }
  }

  isPluginEnabled (i: number) {
    return this.pluginsEnabled[i]
  }

  canTogglePlugin (i: number) {
    return !(this.pluginsEnabled[i] && !('onDisable' in plugins[i]))
  }
}
