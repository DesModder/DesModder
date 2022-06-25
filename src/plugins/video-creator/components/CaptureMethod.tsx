import {
  SmallMathQuillInput,
  SegmentedControl,
  If,
  Switch,
  StaticMathQuillView,
  Button,
  IfElse,
  Checkbox,
  Tooltip,
} from "components";
import { Component, jsx } from "DCGView";
import Controller from "../Controller";
import { cancelCapture, CaptureMethod } from "../backend/capture";
import "./CaptureMethod.css";
import { For } from "components/desmosComponents";

const captureMethodNames: CaptureMethod[] = ["once", "slider", "action"];

export default class SelectCapture extends Component<{
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
          class="dsm-vc-select-capture-method"
          names={() =>
            this.controller.hasAction()
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
                  <div class="dsm-vc-slider-settings">
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
              action: () => (
                <div>
                  <If predicate={() => this.controller.getActions().length > 1}>
                    {() => (
                      <div class="dsm-vc-action-navigate-container">
                        <Button
                          color="primary"
                          onTap={() => this.controller.addToActionIndex(-1)}
                          disabled={() => this.controller.isCapturing}
                        >
                          Prev
                        </Button>
                        <Button
                          color="primary"
                          onTap={() => this.controller.addToActionIndex(+1)}
                          disabled={() => this.controller.isCapturing}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </If>
                  <For
                    each={
                      // using an <If> here doesn't work becaus it doesn't update the StaticMathQuillView
                      () =>
                        this.controller.getCurrentAction()?.latex !== undefined
                          ? [this.controller.getCurrentAction()]
                          : []
                    }
                    key={(action) => action.id}
                  >
                    <div class="dsm-vc-current-action">
                      {() => (
                        <StaticMathQuillView
                          latex={() =>
                            this.controller.getCurrentAction()?.latex as string
                          }
                        />
                      )}
                    </div>
                  </For>
                </div>
              ),
              once: () => null,
            }[this.getSelectedCaptureMethod()]())
          }
        </Switch>
        <div class="dsm-vc-capture-size">
          Size:
          <SmallMathQuillInput
            ariaLabel="capture width"
            onUserChangedLatex={(latex) =>
              this.controller.setCaptureWidthLatex(latex)
            }
            latex={() => this.controller.captureWidthLatex}
            hasError={() => !this.controller.isCaptureWidthValid()}
            onFocusedChanged={(b) =>
              this.controller.updateFocus("capture-width", b)
            }
            isFocused={() => this.controller.isFocused("capture-width")}
          />
          ×
          <SmallMathQuillInput
            ariaLabel="capture height"
            onUserChangedLatex={(latex) =>
              this.controller.setCaptureHeightLatex(latex)
            }
            latex={() => this.controller.captureHeightLatex}
            hasError={() => !this.controller.isCaptureHeightValid()}
            onFocusedChanged={(b) =>
              this.controller.updateFocus("capture-height", b)
            }
            isFocused={() => this.controller.isFocused("capture-height")}
          />
          <If predicate={() => this.controller.isDefaultCaptureSizeDifferent()}>
            {() => (
              <Button
                color="light-gray"
                onTap={() => this.controller.applyDefaultCaptureSize()}
              >
                <i class="dcg-icon-magic" />
              </Button>
            )}
          </If>
        </div>
        <If
          predicate={() =>
            Math.abs(this.controller._getTargetPixelRatio() - 1) > 0.001
          }
        >
          {() => (
            <div class="dsm-vc-pixel-ratio">
              <Checkbox
                checked={() => this.controller.samePixelRatio}
                onChange={(checked: boolean) =>
                  this.controller.setSamePixelRatio(checked)
                }
                ariaLabel="Target same pixel ratio"
              >
                <Tooltip
                  tooltip="Adjusts scaling of line width, point size, label size, etc."
                  gravity="n"
                >
                  <div class="dsm-vc-pixel-ratio-inner">
                    Target same pixel ratio
                  </div>
                </Tooltip>
              </Checkbox>
            </div>
          )}
        </If>
        <div class="dsm-vc-capture">
          {IfElse(
            () =>
              !this.controller.isCapturing ||
              this.controller.captureMethod === "once",
            {
              true: () => (
                <Button
                  color="primary"
                  class="dsm-vc-capture-frame-button"
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
                  color="red"
                  class="dsm-vc-cancel-capture-button"
                  onTap={() => cancelCapture(this.controller)}
                >
                  Cancel
                </Button>
              ),
            }
          )}
          <If predicate={() => this.getSelectedCaptureMethod() === "action"}>
            {() => (
              <div class="dsm-vc-end-condition-settings">
                Step count:
                <SmallMathQuillInput
                  ariaLabel="ticker while"
                  onUserChangedLatex={(v) =>
                    this.controller.setTickCountLatex(v)
                  }
                  hasError={() => !this.controller.isTickCountValid()}
                  latex={() => this.controller.tickCountLatex}
                  isFocused={() =>
                    this.controller.isFocused("capture-tick-count")
                  }
                  onFocusedChanged={(b) =>
                    this.controller.updateFocus("capture-tick-count", b)
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
    return this.controller.captureMethod === "action" &&
      !this.controller.hasAction()
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
