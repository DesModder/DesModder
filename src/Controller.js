export default class Controller {
  constructor () {
    this.menuViewModel = {
      isOpen: false
    }
  }

  init (view) {
    this.view = view
    // here will load menu settings from local storage + header
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
}
