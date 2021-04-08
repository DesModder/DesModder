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
            'dcg-btn-green': !this.controller.isCapturing
          })}
          onTap={() => this.controller.captureOneFrame()}
        >
          One frame
        </span>
      </div>
    )
  }
}
