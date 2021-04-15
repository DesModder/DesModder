import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, Switch,
  StaticMathQuillView, Button
} from 'desmodder'
import Controller, { CaptureMethod } from '../Controller'
import './MainPopup.css'
import SimulationPicker from './SimulationPicker'
import './CaptureMethod.css'

const captureMethodNames: CaptureMethod[] = ['once', 'slider', 'simulation']

export default class SelectCapture extends DCGView.Class<{
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
          class='gif-creator-select-capture-method'
          names={
            () => (
              this.controller.hasSimulation()
                ? captureMethodNames
                : captureMethodNames.slice(0, -1)
            )
          }
          selectedIndex={() => this.getSelectedCaptureMethodIndex()}
          setSelectedIndex={i => this.setSelectedCaptureMethodIndex(i)}
        />
        <Switch
          key={() => this.getSelectedCaptureMethod()}
        >
          {
            () => ({
              'slider': () => (
                <div>
                  <div class='gif-creator-slider-settings'>
                    <SmallMathQuillInput
                      ariaLabel='slider variable'
                      onUserChangedLatex={v => (void console.log(v)) || this.controller.setSliderSetting('variable', v)}
                      hasError={() => !this.controller.isSliderSettingValid('variable')}
                      latex={() => this.controller.sliderSettings.variable}
                    />
                    <StaticMathQuillView
                      latex='='
                    />
                    <SmallMathQuillInput
                      ariaLabel='slider min'
                      onUserChangedLatex={v => this.controller.setSliderSetting('minLatex', v)}
                      hasError={() => !this.controller.isSliderSettingValid('minLatex')}
                      latex={() => this.controller.sliderSettings.minLatex}
                    />
                    to
                    <SmallMathQuillInput
                      ariaLabel='slider max'
                      onUserChangedLatex={v => this.controller.setSliderSetting('maxLatex', v)}
                      hasError={() => !this.controller.isSliderSettingValid('maxLatex')}
                      latex={() => this.controller.sliderSettings.maxLatex}
                    />
                    , step
                    <SmallMathQuillInput
                      ariaLabel='slider step'
                      onUserChangedLatex={v => this.controller.setSliderSetting('stepLatex', v)}
                      hasError={() => !this.controller.isSliderSettingValid('stepLatex')}
                      latex={() => this.controller.sliderSettings.stepLatex}
                    />
                  </div>
                </div>
              ),
              'simulation': () => (
                <div>
                  <If
                    predicate={() => this.controller.getSimulations().length > 1}
                  >
                    {
                      () => (
                        <div class='gif-creator-simulation-navigate-container'>
                          <Button
                            color='green'
                            onTap={() => this.controller.addToSimulationIndex(-1)}
                          >
                            Prev
                          </Button>
                          <Button
                            color='green'
                            onTap={() => this.controller.addToSimulationIndex(+1)}
                          >
                            Next
                          </Button>
                        </div>
                      )
                    }
                  </If>
                  <If
                    predicate={() => this.controller.getSimulations().length > 0}
                  >
                    {
                      () => (
                        <SimulationPicker
                          controller={this.controller}
                        />
                      )
                    }
                  </If>
                </div>
              ),
              'once': () => null
            }[this.getSelectedCaptureMethod()]())
          }
        </Switch>
        <div class='gif-creator-capture'>
          <Button
            color='green'
            class='gif-creator-capture-frame-button'
            disabled={() => (
              this.controller.isCapturing ||
              this.controller.isExporting ||
              !this.controller.areCaptureSettingsValid()
            )}
            onTap={() => this.controller.capture()}
          >
            Capture
          </Button>
          <If
            predicate={() => this.getSelectedCaptureMethod() === 'simulation'}
          >
            {
              () => (
                <div class='gif-creator-end-condition-settings'>
                  While:
                  <SmallMathQuillInput
                    ariaLabel='simulation while'
                    onUserChangedLatex={v => this.controller.setSimulationWhileLatex(v)}
                    hasError={() => !this.controller.isWhileLatexValid()}
                    latex={() => this.controller.simulationWhileLatex}
                  />
                </div>
              )
            }
          </If>
        </div>
      </div>
    )
  }

  getSelectedCaptureMethod () {
    return (
      this.controller.captureMethod === 'simulation' && !this.controller.hasSimulation()
        ? 'once'
        : this.controller.captureMethod
    )
  }

  getSelectedCaptureMethodIndex () {
    return captureMethodNames.indexOf(this.getSelectedCaptureMethod())
  }

  setSelectedCaptureMethodIndex (i: number) {
    const name = captureMethodNames[i]
    if (name !== undefined) {
      this.controller.setCaptureMethod(name)
    }
  }
}
