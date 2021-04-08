import View from './View'
import { Calc } from 'desmodder'

type PNGDataURI = string

export default class Controller {
  view: View | null = null
  frames: PNGDataURI[] = []
  isMainViewOpen: boolean = false

  init (view: View) {
    this.view = view
  }

  updateMainView () {
    this.view && this.view.update()
  }

  toggleMainView () {
    this.isMainViewOpen = !this.isMainViewOpen
    this.updateMainView()
  }

  closeMainView () {
    this.isMainViewOpen = false
    this.updateMainView()
  }

  takeFrame () {
    Calc.asyncScreenshot(
      {
        showLabels: true,
        mode: 'contain',
        preserveAxisLabels: true
      },
      data => {
        this.addFrame(data)
      }
    )
  }

  addFrame (frame: PNGDataURI) {
    this.frames.push(frame)
    this.updateMainView()
  }
}
