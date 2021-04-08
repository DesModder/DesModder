import View from './View'
import { Calc } from 'desmodder'

type PNGDataURI = string

export default class Controller {
  view: View | null = null
  frames: PNGDataURI[] = []
  isMainViewOpen: boolean = false
  isCapturing: boolean = false

  init (view: View) {
    this.view = view
  }

  updateView () {
    this.view && this.view.update()
  }

  toggleMainView () {
    this.isMainViewOpen = !this.isMainViewOpen
    this.updateView()
  }

  closeMainView () {
    this.isMainViewOpen = false
    this.updateView()
  }

  async _captureFrame () {
    return new Promise<void>((resolve) => {
      Calc.asyncScreenshot(
        {
          showLabels: true,
          mode: 'contain',
          preserveAxisLabels: true
        },
        data => {
          this.frames.push(data)
          resolve()
        }
      )
    })
  }

  async captureOneFrame () {
    this.isCapturing = true
    this.updateView()
    await this._captureFrame()
    this.isCapturing = false
    this.updateView()
  }
}
