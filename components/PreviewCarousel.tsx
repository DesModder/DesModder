import { DCGView, If } from 'desmodder'
import './PreviewCarousel.less'
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
          onTap={
            () => (
              this.controller.isPlayPreviewExpanded
                ? this.controller.togglePlayingPreview()
                : this.controller.togglePreviewExpanded()
            )
          }
        >
          <img
            src={() => this.getFrame(0)}
            draggable={false}
          />
          <If
            predicate={() => !this.controller.isPlayPreviewExpanded}
          >
            {
              () => (
                <div
                  class='gif-creator-preview-expand'
                  onTap={
                    (e: Event) => {
                      if (e.target && (e.target as HTMLElement).classList.contains('gif-creator-preview-expand')) {
                        this.controller.togglePreviewExpanded()
                        e.stopPropagation()
                      }
                    }
                  }
                >
                  <i class='dcg-icon-zoom-fit' />
                </div>
              )
            }
          </If>
          <div
            class='gif-creator-remove-frame'
            onTap={
              (e: Event) => {
                this.controller.removeSelectedFrame()
                e.stopPropagation()
              }
            }
          >
            <i class='dcg-icon-delete' />
          </div>
          <div class='gif-creator-preview-index'>
            { () => `${this.getFrameIndex(0) + 1} / ${this.controller.frames.length}` }
          </div>
          <If
            predicate={() => this.controller.frames.length > 1}
          >
            {
              () => (
                <div class='gif-creator-preview-play-pause'>
                  <i class={() => ({
                     'dcg-icon-play': !this.controller.isPlayingPreview,
                     'dcg-icon-pause': this.controller.isPlayingPreview
                  })} />
                </div>
              )
            }
          </If>
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
