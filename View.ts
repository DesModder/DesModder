import {
  DCGView, MountedComponent, pollForValue
} from 'desmodder'
import MainView from './components/MainView'
import Controller from './Controller'

export default class View {
  mountNode: HTMLElement | null = null
  mountedView: MountedComponent | null = null

  constructor (private controller: Controller) {

  }

  async initView () {
    const pillbox = await pollForValue(() => document.querySelector('.dcg-overgraph-pillbox-elements'))
    this.mountNode = document.createElement('div')
    pillbox.insertBefore(this.mountNode, pillbox.querySelector('.dcg-zoom-container'))
    this.mountedView = DCGView.mountToNode(
      MainView,
      this.mountNode,
      {
        controller: () => this.controller
      }
    )
  }

  destroyView () {
    if (this.mountNode === null) {
      return
    }
    DCGView.unmountFromNode(this.mountNode)
  }

  update () {
    this.mountedView && this.mountedView.update()

    const showKeypadButton: HTMLElement | null = document.querySelector('.dcg-show-keypad')
    if (showKeypadButton !== null) {
      showKeypadButton.hidden =
        this.controller.isMainViewOpen && this.controller.isPlayPreviewExpanded
    }
  }
}
