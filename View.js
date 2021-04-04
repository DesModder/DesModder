import DCGView from 'DCGView'
import ReplaceBar from './ReplaceBar'

export default class View {
  constructor () {
    this.mountNode = null
    this.replaceView = null
  }

  init (controller) {
    this.controller = controller
  }

  initView () {
    const searchBar = document.querySelector('.dcg-expression-search-bar')
    const searchContainer = document.createElement('div')
    searchContainer.style.display = 'flex'
    searchContainer.style.flexDirection = 'column'
    searchBar.parentNode.insertBefore(searchContainer, searchBar)
    searchContainer.appendChild(searchBar)
    this.mountNode = document.createElement('div')
    this.mountNode.className = 'findandreplace-expression-replace-bar'
    searchContainer.appendChild(this.mountNode)
    this.replaceView = DCGView.mountToNode(
      ReplaceBar,
      this.mountNode,
      {
        controller: DCGView.const(this.controller)
      }
    )
  }

  destroyView () {
    DCGView.unmountFromNode(this.mountNode)
  }

  updateReplaceView () {
    this.replaceView.update()
  }
}
