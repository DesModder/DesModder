import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, Switch, StaticMathQuillView
} from 'desmodder'
import Controller, { PollingMethod } from '../Controller'
import './MainPopup.css'
import SimulationPicker from './SimulationPicker'
import './SelectPolling.css'

const pollingMethodNames: PollingMethod[] = ['once', 'slider', 'simulation']

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
          class='gif-creator-select-polling-method'
          names={pollingMethodNames}
          selectedIndex={() => this.getSelectedPollingMethodIndex()}
          setSelectedIndex={i => this.setSelectedPollingMethodIndex(i)}
        />
        <Switch
          key={() => this.controller.pollingMethod}
        >
          {
            () => ({
              'slider': () => (
                <div>
                  <div class='gif-creator-slider-settings'>
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
                      onUserChangedLatex={v => this.controller.setSliderSetting('min', parseFloat(v))}
                      latex={() => this.controller.sliderSettings.min.toString()}
                    />
                    to
                    <SmallMathQuillInput
                      ariaLabel='slider max'
                      onUserChangedLatex={v => this.controller.setSliderSetting('max', parseFloat(v))}
                      latex={() => this.controller.sliderSettings.max.toString()}
                    />
                    , step
                    <SmallMathQuillInput
                      ariaLabel='slider step'
                      onUserChangedLatex={v => this.controller.setSliderSetting('step', parseFloat(v))}
                      latex={() => this.controller.sliderSettings.step.toString()}
                    />
                  </div>
                </div>
              ),
              'simulation': () => (
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
                </div>
              ),
              'once': () => null
            }[this.controller.pollingMethod]())
          }
        </Switch>
        <div class='gif-creator-capture'>
          <span
            role='button'
            class={() => ({
              'gif-creator-capture-frame-button': true,
              'dcg-btn-green': !this.controller.isCapturing && !this.controller.isExporting
            })}
            onTap={() => this.controller.capture()}
          >
            Capture
          </span>
          <If
            predicate={() => this.controller.pollingMethod === 'simulation'}
          >
            {
              () => (
                <div class='gif-creator-end-condition-settings'>
                  While:
                  <SmallMathQuillInput
                    ariaLabel='simulation while'
                    onUserChangedLatex={v => this.controller.setSimulationWhileLatex(v)}
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

  getSelectedPollingMethodIndex () {
    return pollingMethodNames.indexOf(this.controller.pollingMethod)
  }

  setSelectedPollingMethodIndex (i: number) {
    this.controller.setPollingMethod(pollingMethodNames[i])
  }
}
