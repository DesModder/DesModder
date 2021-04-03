import plugins from './plugins'

export default class Controller {
  constructor () {
    this.menuViewModel = {
      isOpen: false
    }
    this.pluginsEnabled = {}
    plugins.forEach((e, i) => { this.pluginsEnabled[i] = false })
  }

  init (view) {
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
    this.view.updateMenuView()
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

  disablePlugin (i) {
    if (this.pluginsEnabled[i] && plugins[i].onDisable) {
      plugins[i].onDisable()
      this.pluginsEnabled[i] = false
      this.updateMenuView()
    }
  }

  enablePlugin (i) {
    if (!this.pluginsEnabled[i]) {
      plugins[i].onEnable()
      this.pluginsEnabled[i] = true
      this.updateMenuView()
    }
  }

  togglePlugin (i) {
    if (this.pluginsEnabled[i]) {
      this.disablePlugin(i)
    } else {
      this.enablePlugin(i)
    }
  }

  isPluginEnabled (i) {
    return this.pluginsEnabled[i]
  }

  canTogglePlugin (i) {
    return !(this.pluginsEnabled[i] && !plugins[i].onDisable)
  }
}
