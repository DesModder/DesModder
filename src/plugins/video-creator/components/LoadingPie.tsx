import "./LoadingPie.less";
import { Component, jsx } from "DCGView";

export default class LoadingPie extends Component<{
  // progress 0 to 1 when not pending
  progress: number;
  // if true, just pulse
  isPending: boolean;
}> {
  template() {
    return (
      <div class="dsm-vc-pie-container">
        <div
          class={() => ({
            "dsm-vc-centered-pie": true,
            "dsm-vc-pending": this.props.isPending(),
          })}
        >
          <div class="dsm-vc-base-circle" />
          {/*
            SVG can't be used directly as DCGView element because of SVG namespace
            reasons, and treating it as an HTMLElement causes it to be ignored
            by the browser. Instead, set innerHTML.
          */}
          <div
            onMount={this.setSVG.bind(this)}
            didUpdate={this.setSVG.bind(this)}
          />
        </div>
      </div>
    );
  }

  setSVG(e: HTMLElement) {
    const progress = this.props.progress();
    while (e.firstChild) {
      e.removeChild(e.firstChild);
    }
    if (progress >= 0 && progress <= 1) {
      const svg = document.createElement("svg");
      svg.className = "dsm-vc-pie-overlay";
      svg.setAttribute("viewBox", "-1 -1 2 2");
      const path = document.createElement("path");
      svg.appendChild(path);
      path.setAttribute("d", this.getPiePath());
    }
  }

  getPiePath() {
    const progress = this.props.progress();
    const largeArcFlag = progress >= 0.5 ? "1" : "0";
    // multiply by (1-ε) to make it look like a circle at progress=1
    const angle = 0.9999999 * progress * 2 * Math.PI;
    return [
      "M",
      0,
      0,
      "L",
      0,
      -1,
      "A",
      1,
      1,
      0,
      largeArcFlag,
      1,
      Math.sin(angle),
      -Math.cos(angle),
      "Z",
    ].join(" ");
  }
}
