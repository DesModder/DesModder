import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, StaticMathQuillView
} from 'desmodder'
import Controller, { PollingMethod } from '../Controller'
import './MainPopup.css'
import SimulationPicker from './SimulationPicker'
import './SelectPolling.css'

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
              </div>
            )
          }
        </If>
        <If
          predicate={
            () => (
              this.controller.pollingMethod === 'simulation' &&
              this.controller.hasSimulation()
            )
          }
        >
          {
            () => (void console.log('dd')) || (
              <div>
                <div class='gif-creator-simulation-navigate-container'>
                  <span
                    role='button'
                    class='dcg-btn-green'
                    onTap={() => this.controller.addToSimulationIndex(-1)}
                  >
                    Prev
                  </span>
                  <span
                    role='button'
                    class='dcg-btn-green'
                    onTap={() => this.controller.addToSimulationIndex(+1)}
                  >
                    Next
                  </span>
                </div>
                <SimulationPicker
                  controller={this.controller}
                />
                <div>
                  While:
                  <SmallMathQuillInput
                    ariaLabel='simulation while'
                    onUserChangedLatex={v => this.controller.setSimulationWhileLatex(v)}
                    latex={() => this.controller.simulationWhileLatex}
                  />
                </div>
                <span
                  role='button'
                  class={() => ({
                    'dcg-btn-green': !this.controller.isCapturing
                  })}
                  onTap={() => this.controller.captureSimulation()}
                >
                  Capture
                </span>
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
