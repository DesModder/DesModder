import Controller from "../Controller";
import { cancelCapture, CaptureMethod } from "../backend/capture";
import "./CaptureMethod.css";
import { Component, jsx } from "DCGView";
import {
  SegmentedControl,
  If,
  Switch,
  StaticMathQuillView,
  Button,
  IfElse,
  Checkbox,
  Tooltip,
  InlineMathInputView,
} from "components";
import { For } from "components/desmosComponents";
import { format } from "i18n/i18n-core";

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
        <div class="dsm-vc-select-capture-method">
          <SegmentedControl
            names={() =>
              this.validCaptureMethodNames().map((method) =>
                format("video-creator-method-" + method)
              )
            }
            selectedIndex={() => this.getSelectedCaptureMethodIndex()}
            setSelectedIndex={(i) => this.setSelectedCaptureMethodIndex(i)}
            allowChange={() => !this.controller.isCapturing}
            ariaGroupLabel={"Select capture method"}
          />
        </div>
        <Switch key={() => this.controller.captureMethod}>
          {() =>
            ({
              slider: () => (
                <div>
                  <div class="dsm-vc-slider-settings">
                    <InlineMathInputView
                      ariaLabel="slider variable"
                      handleLatexChanged={(v) =>
                        this.controller.setSliderSetting("variable", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("variable")
                      }
                      latex={() => this.controller.sliderSettings.variable}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-var")
                      }
                      handleFocusChanged={(b) =>
                        this.controller.updateFocus("capture-slider-var", b)
                      }
                    />
                    <StaticMathQuillView latex="=" />
                    <InlineMathInputView
                      ariaLabel="slider min"
                      handleLatexChanged={(v) =>
                        this.controller.setSliderSetting("minLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("minLatex")
                      }
                      latex={() => this.controller.sliderSettings.minLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-min")
                      }
                      handleFocusChanged={(b) =>
                        this.controller.updateFocus("capture-slider-min", b)
                      }
                    />
                    {format("video-creator-to")}
                    <InlineMathInputView
                      ariaLabel="slider max"
                      handleLatexChanged={(v) =>
                        this.controller.setSliderSetting("maxLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("maxLatex")
                      }
                      latex={() => this.controller.sliderSettings.maxLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-max")
                      }
                      handleFocusChanged={(b) =>
                        this.controller.updateFocus("capture-slider-max", b)
                      }
                    />
                    {format("video-creator-step")}
                    <InlineMathInputView
                      ariaLabel="slider step"
                      handleLatexChanged={(v) =>
                        this.controller.setSliderSetting("stepLatex", v)
                      }
                      hasError={() =>
                        !this.controller.isSliderSettingValid("stepLatex")
                      }
                      latex={() => this.controller.sliderSettings.stepLatex}
                      isFocused={() =>
                        this.controller.isFocused("capture-slider-step")
                      }
                      handleFocusChanged={(b) =>
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
                          {format("video-creator-prev-action")}
                        </Button>
                        <Button
                          color="primary"
                          onTap={() => this.controller.addToActionIndex(+1)}
                          disabled={() => this.controller.isCapturing}
                        >
                          {format("video-creator-next-action")}
                        </Button>
                      </div>
                    )}
                  </If>
                  <For
                    each={
                      // using an <If> here doesn't work because it doesn't update the StaticMathQuillView
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
              ticks: () => (
                <div class="dsm-vc-ticks-settings">
                  {format("video-creator-ticks-step")}
                  <InlineMathInputView
                    ariaLabel="time step (ms)"
                    handleLatexChanged={(v) =>
                      this.controller.setTickTimeStepLatex(v)
                    }
                    hasError={() => !this.controller.isTickTimeStepValid()}
                    latex={() => this.controller.tickTimeStepLatex}
                    isFocused={() =>
                      this.controller.isFocused("capture-tick-time-step")
                    }
                    handleFocusChanged={(b) =>
                      this.controller.updateFocus("capture-tick-time-step", b)
                    }
                  />
                </div>
              ),
              once: () => null,
            }[this.controller.captureMethod]())
          }
        </Switch>
        <div class="dsm-vc-capture-size">
          {format("video-creator-size")}
          <InlineMathInputView
            ariaLabel="capture width"
            handleLatexChanged={(latex) =>
              this.controller.setCaptureWidthLatex(latex)
            }
            latex={() => this.controller.captureWidthLatex}
            hasError={() => !this.controller.isCaptureWidthValid()}
            handleFocusChanged={(b) =>
              this.controller.updateFocus("capture-width", b)
            }
            isFocused={() => this.controller.isFocused("capture-width")}
          />
          ×
          <InlineMathInputView
            ariaLabel="capture height"
            handleLatexChanged={(latex) =>
              this.controller.setCaptureHeightLatex(latex)
            }
            latex={() => this.controller.captureHeightLatex}
            hasError={() => !this.controller.isCaptureHeightValid()}
            handleFocusChanged={(b) =>
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
                  tooltip={() => format("video-creator-target-tooltip")}
                  gravity="n"
                >
                  <div class="dsm-vc-pixel-ratio-inner">
                    {format("video-creator-target-same-pixel-ratio")}
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
                  onTap={() => {
                    void this.controller.capture();
                  }}
                >
                  {format("video-creator-capture")}
                </Button>
              ),
              false: () => (
                <Button
                  color="light-gray"
                  class="dsm-vc-cancel-capture-button"
                  onTap={() => cancelCapture(this.controller)}
                >
                  {format("video-creator-cancel-capture")}
                </Button>
              ),
            }
          )}
          <If
            predicate={() =>
              this.controller.captureMethod === "action" ||
              this.controller.captureMethod === "ticks"
            }
          >
            {() => (
              <div class="dsm-vc-end-condition-settings">
                {format("video-creator-step-count")}
                <InlineMathInputView
                  ariaLabel="step count"
                  handleLatexChanged={(v) =>
                    this.controller.setTickCountLatex(v)
                  }
                  hasError={() => !this.controller.isTickCountValid()}
                  latex={() => this.controller.tickCountLatex}
                  isFocused={() =>
                    this.controller.isFocused("capture-tick-count")
                  }
                  handleFocusChanged={(b) =>
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

  validCaptureMethodNames() {
    const captureMethodNames: CaptureMethod[] = [
      "once",
      "slider",
      "action",
      "ticks",
    ];
    return captureMethodNames.filter((s) =>
      this.controller.isCaptureMethodValid(s)
    );
  }

  getSelectedCaptureMethodIndex() {
    return this.validCaptureMethodNames().indexOf(
      this.controller.captureMethod
    );
  }

  setSelectedCaptureMethodIndex(i: number) {
    const name = this.validCaptureMethodNames()[i];
    if (name !== undefined) {
      this.controller.captureMethod = name;
    }
  }
}
