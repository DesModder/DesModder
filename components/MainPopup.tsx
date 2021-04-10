import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, jquery
} from 'desmodder'
import SelectPolling from './SelectPolling'
import PreviewCarousel from './PreviewCarousel'
import Controller, { OutFileType } from '../Controller'
import './MainPopup.css'

const fileTypeNames: OutFileType[] = ['gif', 'mp4', 'webm']

export default class MainPopup extends DCGView.Class<{
  controller: Controller
}> {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='dcg-popover-interior'>
        <div class='gif-creator-capture-menu'>
          <div class='dcg-group-title'>
            Capture
          </div>
          <SelectPolling
            controller={this.controller}
          />
        </div>
        <If
          predicate={() => this.controller.frames.length > 0}
        >
          {
            () => (
              <div class='gif-creator-preview-menu'>
                <div class='dcg-group-title'>
                  Preview
                </div>
                <div
                  class={() => ({
                    'gif-creator-preview-expanded': this.controller.isPlayPreviewExpanded
                  })}
                  onTapEnd={
                    (e: Event) => (
                      this.controller.isPlayPreviewExpanded &&
                      this.eventShouldCloseExpanded(e) &&
                      this.controller.togglePreviewExpanded()
                    )
                  }
                >
                  <div class='gif-creator-preview-inner'>
                    <PreviewCarousel
                      controller={this.controller}
                    />
                    <If
                      predicate={() => this.controller.frames.length > 1}
                    >
                      {
                        () => (
                          <div class='gif-creator-preview-play'>
                            <span
                              role='button'
                              class={() => ({
                                'gif-creator-export-frames-button': true,
                                'dcg-btn-green': true
                              })}
                              onTap={() => this.controller.togglePlayingPreview()}
                            >
                              {
                                () =>
                                  this.controller.isPlayingPreview
                                    ? 'Stop'
                                    : 'Play'
                              }
                            </span>
                          </div>
                        )
                      }
                    </If>
                  </div>
                </div>
              </div>
            )
          }
        </If>
        <div class='gif-creator-export-menu'>
          <div class='dcg-group-title'>
            Export
          </div>
          <div class='gif-creator-select-export-type'>
            <SegmentedControl
              names={fileTypeNames}
              selectedIndex={() => this.getSelectedFileTypeIndex()}
              setSelectedIndex={i => this.setSelectedFileTypeIndex(i)}
            />
          </div>
          <div class='gif-creator-export'>
            <span
              role='button'
              class={() => ({
                'gif-creator-export-frames-button': true,
                'dcg-btn-green': this.controller.frames.length > 0 && !this.controller.isCapturing && !this.controller.isExporting
              })}
              onTap={() => this.controller.exportFrames()}
            >
              Export as { () => this.controller.fileType }
            </span>
            <div class='gif-creator-fps-settings'>
              FPS:
              <SmallMathQuillInput
                ariaLabel='fps'
                onUserChangedLatex={s => this.controller.setFPSLatex(s)}
                hasError={() => this.controller.fpsHasError}
                latex={() => this.controller.fps.toString()}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  getSelectedFileTypeIndex () {
    return fileTypeNames.indexOf(this.controller.fileType)
  }

  setSelectedFileTypeIndex (i: number) {
    this.controller.setOutputFiletype(fileTypeNames[i])
  }

  eventShouldCloseExpanded (e: Event) {
    const el = jquery(e.target)
    return !el.closest('.gif-creator-preview-inner').length
  }
}
