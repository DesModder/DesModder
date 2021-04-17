import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, jquery, Button, IfElse
} from 'desmodder'
import CaptureMethod from './CaptureMethod'
import PreviewCarousel from './PreviewCarousel'
import LoadingPie from './LoadingPie'
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
    return IfElse(
      () => this.controller.isExporting,
      {
        false: () => this.templateNormal(),
        true: () => (
          <div class='dcg-popover-interior'>
            <div class='gif-creator-export-in-progress'>
              Exporting ...
              <LoadingPie
                progress={() => this.controller.exportProgress}
                isPending={() => this.controller.exportProgress < 0 || this.controller.exportProgress > 0.99}
              />
            </div>
          </div>
        )
      }
    )
  }

  templateNormal () {
    return (
      <div class='dcg-popover-interior'>
        <div class='gif-creator-capture-menu'>
          <div class='dcg-group-title'>
            Capture
          </div>
          <CaptureMethod
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
                      predicate={() => this.controller.isPlayPreviewExpanded}
                    >
                      {
                        () => (
                          <div
                            class='gif-creator-exit-expanded'
                            onTap={() => this.controller.togglePreviewExpanded()}
                          >
                            <i class='dcg-icon-remove' />
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
            <Button
              color='green'
              class='gif-creator-export-frames-button'
              onTap={() => this.controller.exportFrames()}
              disabled={
                () => (
                  this.controller.frames.length === 0 ||
                  this.controller.isCapturing ||
                  this.controller.isExporting ||
                  !this.controller.isFPSValid()
                )
              }
            >
              Export as { () => this.controller.fileType }
            </Button>
            <div class='gif-creator-fps-settings'>
              FPS:
              <SmallMathQuillInput
                ariaLabel='fps'
                onUserChangedLatex={s => this.controller.setFPSLatex(s)}
                hasError={() => !this.controller.isFPSValid()}
                latex={() => this.controller.fpsLatex}
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
    const name = fileTypeNames[i]
    if (name !== undefined) {
      this.controller.setOutputFiletype(name)
    }
  }

  eventShouldCloseExpanded (e: Event) {
    const el = jquery(e.target)
    return !el.closest('.gif-creator-preview-inner').length
  }
}
