import {
  DCGView,
  SmallMathQuillInput,
  SegmentedControl,
  If,
  Switch,
  StaticMathQuillView,
  Button,
  Tooltip,
  IfElse,
} from "desmodder";
import Controller from "../Controller";
import { cancelCapture, CaptureMethod } from "../backend/capture";
import SimulationPicker from "./SimulationPicker";
import "./CaptureMethod.css";

const captureMethodNames: CaptureMethod[] = ["once", "slider", "simulation"];

export default class SelectCapture extends DCGView.Class<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
  }

  template() {
    return (
      <div>
        <SegmentedControl
          class="video-creator-select-capture-method"
          names={() =>
            this.controller.hasSimulation()
              ? captureMethodNames
              : captureMethodNames.slice(0, -1)
          }
          selectedIndex={() => this.getSelectedCaptureMethodIndex()}
          setSelectedIndex={(i) => this.setSelectedCaptureMethodIndex(i)}
          allowChange={() => !this.controller.isCapturing}
        />
        <Switch key={() => this.getSelectedCaptureMethod()}>
          {() =>
            ({
              slider: () => (
                <div>
                  <div class="video-creator-slider-settings">
                    <SmallMathQuillInput
                      ariaLabel="slider variable"
                      onUserChangedLatex={(v) =>
                        this.controller.setSliderSetting("variable", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("variable")
                      }
                      latex={() => this.controller.sliderSettings.variable}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-var")
                      }
                      onFocusedChanged={(b) =>
                        this.controller.updateFocus("capture-slider-var", b)
                      }
                    />
                    <StaticMathQuillView latex="=" />
                    <SmallMathQuillInput
                      ariaLabel="slider min"
                      onUserChangedLatex={(v) =>
                        this.controller.setSliderSetting("minLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("minLatex")
                      }
                      latex={() => this.controller.sliderSettings.minLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-min")
                      }
                      onFocusedChanged={(b) =>
                        this.controller.updateFocus("capture-slider-min", b)
                      }
                    />
                    to
                    <SmallMathQuillInput
                      ariaLabel="slider max"
                      onUserChangedLatex={(v) =>
                        this.controller.setSliderSetting("maxLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("maxLatex")
                      }
                      latex={() => this.controller.sliderSettings.maxLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-max")
                      }
                      onFocusedChanged={(b) =>
                        this.controller.updateFocus("capture-slider-max", b)
                      }
                    />
                    , step
                    <SmallMathQuillInput
                      ariaLabel="slider step"
                      onUserChangedLatex={(v) =>
                        this.controller.setSliderSetting("stepLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("stepLatex")
                      }
                      latex={() => this.controller.sliderSettings.stepLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-step")
                      }
                      onFocusedChanged={(b) =>
                        this.controller.updateFocus("capture-slider-step", b)
                      }
                    />
                  </div>
                </div>
              ),
              simulation: () => (
                <div>
                  <If
                    predicate={() =>
                      this.controller.getSimulations().length > 1
                    }
                  >
                    {() => (
                      <div class="video-creator-simulation-navigate-container">
                        <Button
                          color="green"
                          onTap={() => this.controller.addToSimulationIndex(-1)}
                          disabled={() => this.controller.isCapturing}
                        >
                          Prev
                        </Button>
                        <Button
                          color="green"
                          onTap={() => this.controller.addToSimulationIndex(+1)}
                          disabled={() => this.controller.isCapturing}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </If>
                  <If
                    predicate={() =>
                      this.controller.getSimulations().length > 0
                    }
                  >
                    {() => <SimulationPicker controller={this.controller} />}
                  </If>
                </div>
              ),
              once: () => null,
            }[this.getSelectedCaptureMethod()]())
          }
        </Switch>
        <If predicate={() => this.controller.areMathBoundsDifferent}>
          {() => (
            <div class="video-creator-reset-bounds-wrapper">
              <Button
                color="light-gray"
                class="video-creator-reset-bounds-button"
                onTap={() => this.controller.resetMathBounds()}
              >
                Revert Viewport
              </Button>
            </div>
          )}
        </If>
        <div class="video-creator-capture">
          <Tooltip
            tooltip={() =>
              this.controller.isCaptureSizeDifferent
                ? "Aspect ratio different"
                : ""
            }
            gravity="n"
          >
            {IfElse(
              () =>
                !this.controller.isCapturing ||
                this.controller.captureMethod === "once",
              {
                true: () => (
                  <Button
                    color="green"
                    class="video-creator-capture-frame-button"
                    disabled={() =>
                      this.controller.isCapturing ||
                      this.controller.isExporting ||
                      !this.controller.areCaptureSettingsValid()
                    }
                    onTap={() => this.controller.capture()}
                  >
                    Capture
                  </Button>
                ),
                false: () => (
                  <Button
                    color="blue"
                    class="video-creator-cancel-capture-button"
                    onTap={() => cancelCapture()}
                  >
                    Cancel
                  </Button>
                ),
              }
            )}
          </Tooltip>
          <If
            predicate={() => this.getSelectedCaptureMethod() === "simulation"}
          >
            {() => (
              <div class="video-creator-end-condition-settings">
                While:
                <SmallMathQuillInput
                  ariaLabel="simulation while"
                  onUserChangedLatex={(v) =>
                    this.controller.setSimulationWhileLatex(v)
                  }
                  hasError={() => !this.controller.isWhileLatexValid()}
                  latex={() => this.controller.simulationWhileLatex}
                  isFocused={() =>
                    this.controller.isFocused("capture-simulation-while")
                  }
                  onFocusedChanged={(b) =>
                    this.controller.updateFocus("capture-simulation-while", b)
                  }
                />
              </div>
            )}
          </If>
        </div>
      </div>
    );
  }

  getSelectedCaptureMethod() {
    return this.controller.captureMethod === "simulation" &&
      !this.controller.hasSimulation()
      ? "once"
      : this.controller.captureMethod;
  }

  getSelectedCaptureMethodIndex() {
    return captureMethodNames.indexOf(this.getSelectedCaptureMethod());
  }

  setSelectedCaptureMethodIndex(i: number) {
    const name = captureMethodNames[i];
    if (name !== undefined) {
      this.controller.setCaptureMethod(name);
    }
  }
}
