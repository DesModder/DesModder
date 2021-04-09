import {
  DCGView, SmallMathQuillInput, SegmentedControl
} from 'desmodder'
import SelectPolling from './SelectPolling'
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
          <div>
            <span
              role='button'
              class={() => ({
                'gif-creator-capture-frame-button': true,
                'dcg-btn-green': !this.controller.isCapturing && !this.controller.isExporting
              })}
              onTap={() => this.controller.captureOneFrame()}
            >
              One frame
            </span>
          </div>
          <SelectPolling
            controller={this.controller}
          />
        </div>
        <div class='gif-creator-export-menu'>
          <div class='dcg-group-title'>
            Export
          </div>
          <div>
            FPS:
            <SmallMathQuillInput
              ariaLabel='fps'
              onUserChangedLatex={s => this.controller.setFPSLatex(s)}
              hasError={() => this.controller.fpsHasError}
              latex={() => this.controller.fps.toString()}
            />
          </div>
          <div>
            Format:
            <SegmentedControl
              names={fileTypeNames}
              selectedIndex={() => this.getSelectedFileTypeIndex()}
              setSelectedIndex={i => this.setSelectedFileTypeIndex(i)}
            />
          </div>
          <div>
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
}
