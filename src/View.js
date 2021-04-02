import DCGView from 'DCGView'
import MenuView from 'components/MenuView'
import { pollForValue } from './utils'

export default class View {
  async init (controller) {
    await this.mountToggles(controller)
  }

  async mountToggles (controller) {
    const pillbox = await pollForValue(() => document.querySelector('.dcg-overgraph-pillbox-elements'))
    const rootNode = document.createElement('div')
    pillbox.insertBefore(rootNode, pillbox.querySelector('.dcg-zoom-container'))
    this.menuView = DCGView.mountToNode(
      MenuView,
      rootNode,
      {
        controller: () => controller
      }
    )
  }

  updateMenuView () {
    this.menuView?.update()
  }
}
