import DCGView from 'DCGView'
import TogglesView from 'components/TogglesView'
import { pollForValue } from './utils'

export default class View {
  constructor () {
    this.state = {
      menuVisible: false
    }
  }

  async init () {
    await this.mountToggles()
  }

  async mountToggles () {
    const pillbox = await pollForValue(() => document.querySelector('.dcg-overgraph-pillbox-elements'))
    const rootNode = document.createElement('div')
    pillbox.appendChild(rootNode)
    this.togglesView = DCGView.mountToNode(
      TogglesView,
      rootNode,
      {
        menuVisible: () => this.state.menuVisible
      }
    )
  }
}
