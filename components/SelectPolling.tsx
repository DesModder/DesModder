import {
  DCGView, SmallMathQuillInput, SegmentedControl, If, Switch,
  StaticMathQuillView, Button
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
          names={
            () => (
              this.controller.hasSimulation()
                ? pollingMethodNames
                : pollingMethodNames.slice(0, -1)
            )
          }
          selectedIndex={() => this.getSelectedPollingMethodIndex()}
          setSelectedIndex={i => this.setSelectedPollingMethodIndex(i)}
        />
        <Switch
          key={() => this.getSelectedPollingMethod()}
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
            }[this.getSelectedPollingMethod()]())
          }
        </Switch>
        <div class='gif-creator-capture'>
          <Button
            color='green'
            class='gif-creator-capture-frame-button'
            disabled={() => this.controller.isCapturing || this.controller.isExporting}
            onTap={() => this.controller.capture()}
          >
            Capture
          </Button>
          <If
            predicate={() => this.getSelectedPollingMethod() === 'simulation'}
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

  getSelectedPollingMethod () {
    return (
      this.controller.pollingMethod === 'simulation' && !this.controller.hasSimulation()
        ? 'once'
        : this.controller.pollingMethod
    )
  }

  getSelectedPollingMethodIndex () {
    return pollingMethodNames.indexOf(this.getSelectedPollingMethod())
  }

  setSelectedPollingMethodIndex (i: number) {
    this.controller.setPollingMethod(pollingMethodNames[i])
  }
}
