import "./CaptureMethod.css";
import { Component, jsx } from "#DCGView";
import { If, StaticMathQuillView, IconButton } from "#components";
import { format } from "#i18n";
import ManagedNumberInput from "./ManagedNumberInput";
import { Orientation } from "../orientation";

export class OrientationView extends Component<{
  or: Orientation;
}> {
  or!: Orientation;

  init() {
    this.or = this.props.or();
  }

  template() {
    return (
      <span>
        <If predicate={() => this.or.isCurrentOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle")}
              <StaticMathQuillView latex="\ xy=" />
              <ManagedNumberInput
                focusID="current-xy-rot"
                // TODO-localization
                ariaLabel="current rotation in xy plane"
                hasError={() => !this.or.isCurrentXYRotValid()}
                vc={this.or.vc}
                data={this.or.xyRot}
                numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ z=" />
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
          )}
        </If>
        <If predicate={() => this.or.isToOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle-to")}
              <StaticMathQuillView latex="\ xy=" />
              <ManagedNumberInput
                focusID="to-xy-rot"
                // TODO-localization
                ariaLabel="to rotation in xy plane"
                hasError={() => !this.or.isXYRotToValid()}
                vc={this.or.vc}
                data={this.or.xyRotTo}
                numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ z=" />
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
          )}
        </If>
        <If predicate={() => this.or.isStepOrientationRelevant()}>
          {() => (
            <div class="dsm-vc-orientation">
              {format("video-creator-angle-step")}
              <StaticMathQuillView latex="\ \Delta xy=" />
              <ManagedNumberInput
                focusID="step-xy-rot"
                // TODO-localization
                ariaLabel="step rotation in xy plane"
                hasError={() => !this.or.isXYRotStepValid()}
                vc={this.or.vc}
                data={this.or.xyRotStep}
                numberUnits={this.or.cc.isDegreeMode() ? "°" : "rad"}
              />
              <StaticMathQuillView latex="\ \Delta z=" />
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
          )}
        </If>
        <If predicate={() => this.or.isSpeedOrientationRelevant()}>
          {() => (
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
                hasError={() => !this.or.isSpeedRotValid()}
                vc={this.or.vc}
                data={this.or.speedRot}
                numberUnits={this.or.cc.isDegreeMode() ? "°/s" : "rad/s"}
              />
            </div>
          )}
        </If>
      </span>
    );
  }
}
