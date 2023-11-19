import "./CaptureMethod.css";
import { Component, jsx } from "#DCGView";
import {
  If,
  StaticMathQuillView,
  IconButton,
  SwitchUnion,
  SegmentedControl,
} from "#components";
import { format } from "#i18n";
import ManagedNumberInput from "./ManagedNumberInput";
import { Orientation } from "../orientation";

const orientationModes = ["current-speed", "current-delta", "from-to"] as const;

export class OrientationView extends Component<{
  or: Orientation;
}> {
  or!: Orientation;

  init() {
    this.or = this.props.or();
  }

  template() {
    return (
      <div>
        <div class="dsm-vc-select-orientation-mode">
          <SegmentedControl
            names={() =>
              orientationModes.map((mode) =>
                format("video-creator-orientation-mode-" + mode)
              )
            }
            selectedIndex={() => this.getOrientationModeIndex()}
            setSelectedIndex={(i) => this.setOrientationModeIndex(i)}
            allowChange={() => !this.or.vc.isCapturing}
            // TODO-localization
            ariaGroupLabel={"Select orientation method"}
          />
        </div>
        {SwitchUnion(() => this.or.orientationMode, {
          none: () => <span />,
          "current-delta": () => this.templateCurrentDelta(),
          "current-speed": () => this.templateCurrentSpeed(),
          "from-to": () => this.templateFromTo(),
        })}
      </div>
    );
  }

  getOrientationModeIndex() {
    if (this.or.orientationMode === "none") return 0;
    return orientationModes.indexOf(this.or.orientationMode);
  }

  setOrientationModeIndex(i: number) {
    const mode = orientationModes[i];
    if (mode !== undefined) {
      this.or.orientationMode = mode;
    }
  }

  templateCurrent() {
    return (
      <div class="dsm-vc-orientation">
        {format("video-creator-angle-current")}
        <StaticMathQuillView latex="\ xy:" />
        <ManagedNumberInput
          focusID="current-xy-rot"
          // TODO-localization
          ariaLabel="current rotation in xy plane"
          hasError={() => !this.or.isCurrentXYRotValid()}
          vc={this.or.vc}
          data={this.or.xyRot}
          numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
        />
        <StaticMathQuillView latex="\ z:" />
        <ManagedNumberInput
          focusID="current-z-tip"
          // TODO-localization
          ariaLabel="current rotation tipping z axis towards camera"
          hasError={() => !this.or.isCurrentZTipValid()}
          vc={this.or.vc}
          data={this.or.zTip}
          numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
        />
      </div>
    );
  }

  templateCurrentSpeed() {
    return (
      <span>
        {this.templateCurrent()}
        <div class="dsm-vc-orientation">
          {format("video-creator-angle-speed")}
          <If
            predicate={() => {
              const sd = this.or.getSpinningSpeedAndDirection();
              if (!sd) return false;
              return sd.speed !== 0;
            }}
          >
            {() => (
              <span>
                {" "}
                <IconButton
                  onTap={() => this.or.toggleSpinningDirection()}
                  iconClass={() => {
                    const dir = this.or.getSpinningSpeedAndDirection()?.dir;
                    return dir === "xyRot"
                      ? "dcg-icon-move-horizontal"
                      : "dcg-icon-move-vertical";
                  }}
                  small={true}
                />
                <StaticMathQuillView
                  latex={() =>
                    this.or.getSpinningSpeedAndDirection()?.dir === "zTip"
                      ? "\\ z:"
                      : "\\ xy:"
                  }
                />
              </span>
            )}
          </If>
          <ManagedNumberInput
            focusID="speed-rot"
            // TODO-localization
            ariaLabel="speed rotation"
            hasError={() => !this.or.isSpeedRotValid()}
            vc={this.or.vc}
            data={this.or.speedRot}
            numberUnits={this.or.cc.isDegreeMode() ? "°/s" : "rad/s"}
          />
        </div>
      </span>
    );
  }

  templateCurrentDelta() {
    return (
      <span>
        {this.templateCurrent()}
        <div class="dsm-vc-orientation">
          {format("video-creator-angle-step")}
          <StaticMathQuillView latex="\ \Delta xy:" />
          <ManagedNumberInput
            focusID="step-xy-rot"
            // TODO-localization
            ariaLabel="step rotation in xy plane"
            hasError={() => !this.or.isXYRotStepValid()}
            vc={this.or.vc}
            data={this.or.xyRotStep}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
          <StaticMathQuillView latex="\ \Delta z:" />
          <ManagedNumberInput
            focusID="step-z-tip"
            // TODO-localization
            ariaLabel="step rotation tipping z axis towards camera"
            hasError={() => !this.or.isZTipStepValid()}
            vc={this.or.vc}
            data={this.or.zTipStep}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
        </div>
      </span>
    );
  }

  templateFromTo() {
    return (
      <span>
        <div class="dsm-vc-orientation">
          {format("video-creator-angle-from")}
          <StaticMathQuillView latex="\ xy:" />
          <ManagedNumberInput
            focusID="from-xy-rot"
            // TODO-localization
            ariaLabel="from rotation in xy plane"
            hasError={() => !this.or.isXYRotFromValid()}
            vc={this.or.vc}
            data={this.or.xyRotFrom}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
          <StaticMathQuillView latex="\ z:" />
          <ManagedNumberInput
            focusID="from-z-tip"
            // TODO-localization
            ariaLabel="from rotation tipping z axis towards camera"
            hasError={() => !this.or.isZTipFromValid()}
            vc={this.or.vc}
            data={this.or.zTipFrom}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
        </div>
        <div class="dsm-vc-orientation">
          {format("video-creator-angle-to")}
          <StaticMathQuillView latex="\ xy:" />
          <ManagedNumberInput
            focusID="to-xy-rot"
            // TODO-localization
            ariaLabel="to rotation in xy plane"
            hasError={() => !this.or.isXYRotToValid()}
            vc={this.or.vc}
            data={this.or.xyRotTo}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
          <StaticMathQuillView latex="\ z:" />
          <ManagedNumberInput
            focusID="to-z-tip"
            // TODO-localization
            ariaLabel="to rotation tipping z axis towards camera"
            hasError={() => !this.or.isZTipToValid()}
            vc={this.or.vc}
            data={this.or.zTipTo}
            numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
          />
        </div>
      </span>
    );
  }
}
