import VideoCreator from "..";
import { CaptureMethod } from "../backend/capture";
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
import ManagedNumberInput from "./ManagedNumberInput";

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
            // TODO-localization
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
                    handleLatexChanged={(v) => this.vc.setSliderVariable(v)}
                    hasError={() => !this.vc.isSliderVariableValid()}
                    latex={() => this.vc.sliderVariable}
                    isFocused={() => this.vc.isFocused("capture-slider-var")}
                    handleFocusChanged={(b) =>
                      this.vc.updateFocus("capture-slider-var", b)
                    }
                    controller={this.vc.cc}
                  />
                </span>
                <StaticMathQuillView latex="=" />
                <ManagedNumberInput
                  focusID="capture-slider-min"
                  // TODO-localization
                  ariaLabel="slider min"
                  hasError={() => !this.vc.isSliderSettingValid("min")}
                  vc={this.vc}
                  data={this.vc.sliderSettings.min}
                />
                {format("video-creator-to")}
                <ManagedNumberInput
                  focusID="capture-slider-max"
                  // TODO-localization
                  ariaLabel="slider max"
                  hasError={() => !this.vc.isSliderSettingValid("max")}
                  vc={this.vc}
                  data={this.vc.sliderSettings.max}
                />
                {format("video-creator-step")}
                <ManagedNumberInput
                  focusID="capture-slider-step"
                  // TODO-localization
                  ariaLabel="slider step"
                  hasError={() => !this.vc.isSliderSettingValid("step")}
                  vc={this.vc}
                  data={this.vc.sliderSettings.step}
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
              <div class="dsm-vc-current-action">
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
                  {() => (
                    <StaticMathQuillView
                      latex={() => this.vc.getCurrentAction().latex!}
                    />
                  )}
                </For>
              </div>
            </div>
          ),
          ticks: () => (
            <div class="dsm-vc-ticks-settings">
              <If predicate={() => this.vc.cc.getPlayingSliders().length > 0}>
                {() => (
                  <div>
                    {format("video-creator-ticks-playing-sliders")}{" "}
                    <span class="dsm-vc-playing-sliders">
                      <StaticMathQuillView
                        latex={() =>
                          this.vc.cc
                            .getPlayingSliders()
                            .map((L) => L.latex.split("=")[0])
                            .join(",\\ ")
                        }
                      />
                    </span>
                  </div>
                )}
              </If>
              <div>
                {format("video-creator-ticks-step")}
                <ManagedNumberInput
                  focusID="capture-tick-time-step"
                  // TODO-localization
                  ariaLabel="time step (ms)"
                  hasError={() => !this.vc.isTickTimeStepValid()}
                  vc={this.vc}
                  data={this.vc.tickTimeStep}
                />
              </div>
            </div>
          ),
          ntimes: () => null,
          once: () => null,
        })}
        <div class="dsm-vc-capture-size">
          {format("video-creator-size")}
          <ManagedNumberInput
            focusID="capture-width"
            // TODO-localization
            ariaLabel="capture width"
            hasError={() => !this.vc.isCaptureWidthValid()}
            vc={this.vc}
            data={this.vc.captureWidth}
          />
          ×
          <ManagedNumberInput
            focusID="capture-height"
            // TODO-localization
            ariaLabel="capture height"
            hasError={() => !this.vc.isCaptureHeightValid()}
            vc={this.vc}
            data={this.vc.captureHeight}
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
                  onTap={() => this.vc.cancelCapture()}
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
                <ManagedNumberInput
                  focusID="capture-tick-count"
                  // TODO-localization
                  ariaLabel="step count"
                  hasError={() => !this.vc.isTickCountValid()}
                  vc={this.vc}
                  data={this.vc.tickCount}
                />
              </div>
            )}
          </If>
          <If predicate={() => this.vc.captureMethod === "ntimes"}>
            {() => (
              <div class="dsm-vc-end-condition-settings">
                {format("video-creator-frame-count")}
                <ManagedNumberInput
                  focusID="capture-frame-count"
                  // TODO-localization
                  ariaLabel="frame count"
                  hasError={() => !this.vc.isTickCountValid()}
                  vc={this.vc}
                  data={this.vc.tickCount}
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
      "ntimes",
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
