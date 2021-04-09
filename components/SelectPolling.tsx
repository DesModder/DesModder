import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, StaticMathQuillView
} from 'desmodder'
import Controller, { PollingMethod } from '../Controller'
import './MainPopup.css'

const pollingMethodNames: PollingMethod[] = ['slider', 'simulation']

export default class SelectPolling extends DCGView.Class<{
  controller: Controller
}> {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div>
        <SegmentedControl
          names={pollingMethodNames}
          selectedIndex={() => this.getSelectedPollingMethodIndex()}
          setSelectedIndex={i => this.setSelectedPollingMethodIndex(i)}
        />
        <If
          predicate={() => this.controller.pollingMethod === 'slider'}
        >
          {
            () => (
              <div>
                <SmallMathQuillInput
                  ariaLabel='slider variable'
                  onUserChangedLatex={v => this.controller.setSliderSetting('variable', v)}
                  latex={() => this.controller.sliderSettings.variable}
                />
                <StaticMathQuillView
                  latex='='
                />
                <SmallMathQuillInput
                  ariaLabel='slider min'
                  onUserChangedLatex={v => this.controller.setSliderSetting('min', parseInt(v))}
                  latex={() => this.controller.sliderSettings.min.toString()}
                />
                to
                <SmallMathQuillInput
                  ariaLabel='slider max'
                  onUserChangedLatex={v => this.controller.setSliderSetting('max', parseInt(v))}
                  latex={() => this.controller.sliderSettings.max.toString()}
                />
                , step
                <SmallMathQuillInput
                  ariaLabel='slider step'
                  onUserChangedLatex={v => this.controller.setSliderSetting('step', parseInt(v))}
                  latex={() => this.controller.sliderSettings.step.toString()}
                />
                <span
                  role='button'
                  class={() => ({
                    'dcg-btn-green': !this.controller.isCapturing
                  })}
                  onTap={() => this.controller.captureSlider()}
                >
                  Capture
                </span>
                {
                  /*
                    Slider variable
                    Number inputs (new component?):
                      Slider start
                      Slider end
                      Slider step
                    Show computed number of frames
                  */
                }
              </div>
            )
          }
        </If>
      </div>
    )
  }

  getSelectedPollingMethodIndex () {
    return pollingMethodNames.indexOf(this.controller.pollingMethod)
  }

  setSelectedPollingMethodIndex (i: number) {
    this.controller.setPollingMethod(pollingMethodNames[i])
  }
}
