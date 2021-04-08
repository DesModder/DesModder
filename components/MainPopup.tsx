import { DCGView } from 'desmodder'
import Controller from '../Controller'
import './MainPopup.css'

export default class MainPopup extends DCGView.Class {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='dcg-popover-interior'>
        <div class='dcg-group-title'>
          DesModder GIF Creator
        </div>
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
        {/* TODO: segmented select with file type gif/mp4/webm */}
        {/* TODO: fps option */}
        <span
          role='button'
          class={() => ({
            'gif-creator-export-frames-button': true,
            'dcg-btn-green': this.controller.frames.length > 0 && !this.controller.isCapturing && !this.controller.isExporting
          })}
          onTap={() => this.controller.exportFrames()}
        >
          Export as mp4
        </span>
      </div>
    )
  }
}
