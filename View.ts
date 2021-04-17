import {
  DCGView, MountedComponent, pollForValue, Calc
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
    Calc.controller.dispatcher.register((e) => {
      if (e.type === 'keypad/set-minimized' || e.type === 'close-graph-settings') {
        this.updatePillboxHeight()
      }
    })
  }

  updatePillboxHeight () {
    const pillboxContainer = document.querySelector('.dcg-overgraph-pillbox-elements') as HTMLElement | null
    if (pillboxContainer !== null) {
      // accounting for future contingency where keypad is actually allowed
      // to be open (maybe when popover integreated into main Desmodder components)
      const t = Calc.controller.isKeypadOpen() ? Calc.controller.getKeypadHeight() : 0
      const bottom = this.controller.isMainViewOpen ? t + 'px' : 'auto'
      pillboxContainer.style.bottom = bottom
    }
  }

  destroyView () {
    if (this.mountNode === null) {
      return
    }
    DCGView.unmountFromNode(this.mountNode)
  }

  update () {
    this.updatePillboxHeight()
    this.mountedView && this.mountedView.update()

    const showKeypadButton: HTMLElement | null = document.querySelector('.dcg-show-keypad')
    if (showKeypadButton !== null) {
      showKeypadButton.hidden =
        this.controller.isMainViewOpen && this.controller.isPlayPreviewExpanded
    }
  }
}
