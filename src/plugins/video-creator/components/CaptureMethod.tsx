import VideoCreator from "..";
import { cancelCapture, CaptureMethod } from "../backend/capture";
import "./CaptureMethod.css";
import { Component, jsx } from "#DCGView";
import {
  SegmentedControl,
  If,
  SwitchUnion,
  StaticMathQuillView,
  Button,
  IfElse,
  Checkbox,
  Tooltip,
  InlineMathInputView,
  For,
} from "#components";
import { format } from "#i18n";

export default class SelectCapture extends Component<{
  vc: VideoCreator;
}> {
  vc!: VideoCreator;

  init() {
    this.vc = this.props.vc();
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
            allowChange={() => !this.vc.isCapturing}
            ariaGroupLabel={"Select capture method"}
          />
        </div>
        {SwitchUnion(() => this.vc.captureMethod, {
          slider: () => (
            <div>
              <div class="dsm-vc-slider-settings">
                <span class="yes-intellisense">
                  <InlineMathInputView
                    ariaLabel="slider variable"
                    handleLatexChanged={(v) =>
                      this.vc.setSliderSetting("variable", v)
                    }
                    hasError={() => !this.vc.isSliderSettingValid("variable")}
                    latex={() => this.vc.sliderSettings.variable}
                    isFocused={() => this.vc.isFocused("capture-slider-var")}
                    handleFocusChanged={(b) =>
                      this.vc.updateFocus("capture-slider-var", b)
                    }
                  />
                </span>
                <StaticMathQuillView latex="=" />
                <InlineMathInputView
                  ariaLabel="slider min"
                  handleLatexChanged={(v) =>
                    this.vc.setSliderSetting("minLatex", v)
                  }
                  hasError={() => !this.vc.isSliderSettingValid("minLatex")}
                  latex={() => this.vc.sliderSettings.minLatex}
                  isFocused={() => this.vc.isFocused("capture-slider-min")}
                  handleFocusChanged={(b) =>
                    this.vc.updateFocus("capture-slider-min", b)
                  }
                />
                {format("video-creator-to")}
                <InlineMathInputView
                  ariaLabel="slider max"
                  handleLatexChanged={(v) =>
                    this.vc.setSliderSetting("maxLatex", v)
                  }
                  hasError={() => !this.vc.isSliderSettingValid("maxLatex")}
                  latex={() => this.vc.sliderSettings.maxLatex}
                  isFocused={() => this.vc.isFocused("capture-slider-max")}
                  handleFocusChanged={(b) =>
                    this.vc.updateFocus("capture-slider-max", b)
                  }
                />
                {format("video-creator-step")}
                <InlineMathInputView
                  ariaLabel="slider step"
                  handleLatexChanged={(v) =>
                    this.vc.setSliderSetting("stepLatex", v)
                  }
                  hasError={() => !this.vc.isSliderSettingValid("stepLatex")}
                  latex={() => this.vc.sliderSettings.stepLatex}
                  isFocused={() => this.vc.isFocused("capture-slider-step")}
                  handleFocusChanged={(b) =>
                    this.vc.updateFocus("capture-slider-step", b)
                  }
                />
              </div>
            </div>
          ),
          action: () => (
            <div>
              <If predicate={() => this.vc.getActions().length > 1}>
                {() => (
                  <div class="dsm-vc-action-navigate-container">
                    <Button
                      color="primary"
                      onTap={() => this.vc.addToActionIndex(-1)}
                      disabled={() => this.vc.isCapturing}
                    >
                      {format("video-creator-prev-action")}
                    </Button>
                    <Button
                      color="primary"
                      onTap={() => this.vc.addToActionIndex(+1)}
                      disabled={() => this.vc.isCapturing}
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
                    this.vc.getCurrentAction()?.latex !== undefined
                      ? [this.vc.getCurrentAction()]
                      : []
                }
                key={(action) => action.id}
              >
                <div class="dsm-vc-current-action">
                  {() => (
                    <StaticMathQuillView
                      latex={() => this.vc.getCurrentAction()?.latex as string}
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
                handleLatexChanged={(v) => this.vc.setTickTimeStepLatex(v)}
                hasError={() => !this.vc.isTickTimeStepValid()}
                latex={() => this.vc.tickTimeStepLatex}
                isFocused={() => this.vc.isFocused("capture-tick-time-step")}
                handleFocusChanged={(b) =>
                  this.vc.updateFocus("capture-tick-time-step", b)
                }
              />
            </div>
          ),
          once: () => null,
        })}
        <div class="dsm-vc-capture-size">
          {format("video-creator-size")}
          <InlineMathInputView
            ariaLabel="capture width"
            handleLatexChanged={(latex) => this.vc.setCaptureWidthLatex(latex)}
            latex={() => this.vc.captureWidthLatex}
            hasError={() => !this.vc.isCaptureWidthValid()}
            handleFocusChanged={(b) => this.vc.updateFocus("capture-width", b)}
            isFocused={() => this.vc.isFocused("capture-width")}
          />
          ×
          <InlineMathInputView
            ariaLabel="capture height"
            handleLatexChanged={(latex) => this.vc.setCaptureHeightLatex(latex)}
            latex={() => this.vc.captureHeightLatex}
            hasError={() => !this.vc.isCaptureHeightValid()}
            handleFocusChanged={(b) => this.vc.updateFocus("capture-height", b)}
            isFocused={() => this.vc.isFocused("capture-height")}
          />
          <If predicate={() => this.vc.isDefaultCaptureSizeDifferent()}>
            {() => (
              <Button
                color="light-gray"
                onTap={() => this.vc.applyDefaultCaptureSize()}
              >
                <i class="dsm-icon-magic" />
              </Button>
            )}
          </If>
        </div>
        <If
          predicate={() => Math.abs(this.vc._getTargetPixelRatio() - 1) > 0.001}
        >
          {() => (
            <div class="dsm-vc-pixel-ratio">
              <Checkbox
                checked={() => this.vc.samePixelRatio}
                onChange={(checked: boolean) =>
                  this.vc.setSamePixelRatio(checked)
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
            () => !this.vc.isCapturing || this.vc.captureMethod === "once",
            {
              true: () => (
                <Button
                  color="primary"
                  class="dsm-vc-capture-frame-button"
                  disabled={() =>
                    this.vc.isCapturing ||
                    this.vc.isExporting ||
                    !this.vc.areCaptureSettingsValid()
                  }
                  onTap={() => {
                    void this.vc.capture();
                  }}
                >
                  {format("video-creator-capture")}
                </Button>
              ),
              false: () => (
                <Button
                  color="light-gray"
                  class="dsm-vc-cancel-capture-button"
                  onTap={() => cancelCapture(this.vc)}
                >
                  {format("video-creator-cancel-capture")}
                </Button>
              ),
            }
          )}
          <If
            predicate={() =>
              this.vc.captureMethod === "action" ||
              this.vc.captureMethod === "ticks"
            }
          >
            {() => (
              <div class="dsm-vc-end-condition-settings">
                {format("video-creator-step-count")}
                <InlineMathInputView
                  ariaLabel="step count"
                  handleLatexChanged={(v) => this.vc.setTickCountLatex(v)}
                  hasError={() => !this.vc.isTickCountValid()}
                  latex={() => this.vc.tickCountLatex}
                  isFocused={() => this.vc.isFocused("capture-tick-count")}
                  handleFocusChanged={(b) =>
                    this.vc.updateFocus("capture-tick-count", b)
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
    return captureMethodNames.filter((s) => this.vc.isCaptureMethodValid(s));
  }

  getSelectedCaptureMethodIndex() {
    return this.validCaptureMethodNames().indexOf(this.vc.captureMethod);
  }

  setSelectedCaptureMethodIndex(i: number) {
    const name = this.validCaptureMethodNames()[i];
    if (name !== undefined) {
      this.vc.captureMethod = name;
    }
  }
}
