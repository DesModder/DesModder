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
  IconButton,
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
            // TODO: For "ticks", display something like
            //      Moving sliders: 5
            // or   Moving sliders: a, b, c, d, f
            // To make it clear that ticks refers to sliders.
            <div class="dsm-vc-ticks-settings">
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
          ),
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
        <If predicate={() => this.vc.isCurrentOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle")}
              <StaticMathQuillView latex="\ xy=" />
              <ManagedNumberInput
                focusID="current-xy-rot"
                // TODO-localization
                ariaLabel="current rotation in xy plane"
                hasError={() => !this.vc.isCurrentXYRotValid()}
                vc={this.vc}
                data={this.vc.xyRot}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ z=" />
              <ManagedNumberInput
                focusID="current-z-tip"
                // TODO-localization
                ariaLabel="current rotation tipping z axis towards camera"
                hasError={() => !this.vc.isCurrentZTipValid()}
                vc={this.vc}
                data={this.vc.zTip}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
            </div>
          )}
        </If>
        <If predicate={() => this.vc.isToOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle-to")}
              <StaticMathQuillView latex="\ xy=" />
              <ManagedNumberInput
                focusID="to-xy-rot"
                // TODO-localization
                ariaLabel="to rotation in xy plane"
                hasError={() => !this.vc.isXYRotToValid()}
                vc={this.vc}
                data={this.vc.xyRotTo}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ z=" />
              <ManagedNumberInput
                focusID="to-z-tip"
                // TODO-localization
                ariaLabel="to rotation tipping z axis towards camera"
                hasError={() => !this.vc.isZTipToValid()}
                vc={this.vc}
                data={this.vc.zTipTo}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
            </div>
          )}
        </If>
        <If predicate={() => this.vc.isStepOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle-step")}
              <StaticMathQuillView latex="\ \Delta xy=" />
              <ManagedNumberInput
                focusID="step-xy-rot"
                // TODO-localization
                ariaLabel="step rotation in xy plane"
                hasError={() => !this.vc.isXYRotStepValid()}
                vc={this.vc}
                data={this.vc.xyRotStep}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ \Delta z=" />
              <ManagedNumberInput
                focusID="step-z-tip"
                // TODO-localization
                ariaLabel="step rotation tipping z axis towards camera"
                hasError={() => !this.vc.isZTipStepValid()}
                vc={this.vc}
                data={this.vc.zTipStep}
                numberUnits={this.vc.cc.isDegreeMode() ? "°" : "rad"}
              />
            </div>
          )}
        </If>
        <If predicate={() => this.vc.isSpeedOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle-speed")}
              <If
                predicate={() => {
                  const sd = this.vc.getSpinningSpeedAndDirection();
                  if (!sd) return false;
                  return sd.speed !== 0;
                }}
              >
                {() => (
                  <span>
                    {" "}
                    <IconButton
                      onTap={() => this.vc.toggleSpinningDirection()}
                      iconClass={() => {
                        const dir = this.vc.getSpinningSpeedAndDirection()?.dir;
                        return dir === "xyRot"
                          ? "dcg-icon-move-horizontal"
                          : "dcg-icon-move-vertical";
                      }}
                      small={true}
                    />
                    <StaticMathQuillView
                      latex={() =>
                        this.vc.getSpinningSpeedAndDirection()?.dir === "zTip"
                          ? "\\ z="
                          : "\\ xy="
                      }
                    />
                  </span>
                )}
              </If>
              <ManagedNumberInput
                focusID="speed-rot"
                // TODO-localization
                ariaLabel="speed rotation"
                hasError={() => !this.vc.isSpeedRotValid()}
                vc={this.vc}
                data={this.vc.speedRot}
                numberUnits={this.vc.cc.isDegreeMode() ? "°/s" : "rad/s"}
              />
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
