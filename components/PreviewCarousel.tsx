import { DCGView } from 'desmodder'
import './PreviewCarousel.css'
import Controller from '../Controller'

export default class PreviewCarousel extends DCGView.Class<{
  controller: Controller
}> {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='gif-creator-preview-carousel'>
        <div
          class={() => ({
            'gif-creator-preview-prev-frame': true,
            'gif-creator-preview-wrapped-frame':
              this.getFrameIndex(-1) > this.getFrameIndex(0)
          })}
          onTap={() => this.controller.addToPreviewIndex(-1)}
        >
          <img
            src={() => this.getFrame(-1)}
            draggable={false}
          />
          <div class='gif-creator-preview-index'>
            { () => this.getFrameIndex(-1) + 1 }
          </div>
        </div>
        <div
          class={() => ({
            'gif-creator-preview-next-frame': true,
            'gif-creator-preview-wrapped-frame':
              this.getFrameIndex(1) < this.getFrameIndex(0)
          })}
          onTap={() => this.controller.addToPreviewIndex(1)}
        >
          <img
            src={() => this.getFrame(1)}
            draggable={false}
          />
          <div class='gif-creator-preview-index'>
            { () => this.getFrameIndex(1) + 1 }
          </div>
        </div>
        <div
          class='gif-creator-preview-current-frame'
          onTap={() => this.controller.togglePreviewExpanded()}
        >
          <img
            src={() => this.getFrame(0)}
            draggable={false}
          />
          <div class='gif-creator-preview-index'>
            { () => this.getFrameIndex(0) + 1 }
            /
            { () => this.controller.frames.length }
          </div>
        </div>
      </div>
    )
  }

  getFrameIndex (dx: number) {
    const L = this.controller.frames.length
    return ((this.controller.previewIndex + dx) % L + L) % L
  }

  getFrame (dx: number) {
    return this.controller.frames[this.getFrameIndex(dx)]
  }
}
