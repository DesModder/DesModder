import { IconButton, Tooltip } from "components";
import { Component, jsx } from "DCGView";
import { TimingData } from "globals/Calc";
import Controller from "./Controller";
import DesModderController from "main/Controller"
import "./PerformanceView.less";

export class PerformanceView extends Component<{
  controller: () => Controller;
  desModderController: () => DesModderController;
}> {
  template() {
    return (
      <div class="dcg-popover-interior dsm-performance-info-menu">
        <div class="dsm-pi-pin-menu-button-container">
          <Tooltip gravity="w" tooltip="Keep menu open">
            <IconButton
              iconClass={() =>
                this.props.desModderController().pillboxMenuPinned
                  ? "dsm-icon-bookmark"
                  : "dsm-icon-bookmark-outline-add"
              }
              onTap={() => {
                this.props.desModderController().toggleMenuPinned()
              }}
              class="dsm-pi-pin-menu-button"
            />
          </Tooltip>
        </div>
        <ul>
          <li>
            <strong>Time In Worker: </strong>
            {() =>
              Math.round(this.props.controller().getTimingData().timeInWorker)
            }
            ms
          </li>
          <li>
            <strong>Compiling: </strong>
            {() =>
              Math.round(this.props.controller().getTimingData().updateAnalysis)
            }
            ms
          </li>
          <li>
            <strong>Rendering: </strong>
            {() =>
              Math.round(
                this.props.controller().getTimingData().graphAllChanges
              )
            }
            ms
          </li>
          <li>
            <strong>Other: </strong>
            {() => {
              const timingData = this.props.controller().getTimingData();
              return Math.round(
                timingData.computeAllLabels +
                  timingData.computeAriaDescriptions +
                  timingData.processStatements +
                  timingData.publishAllStatuses +
                  timingData.updateIntersections
              );
            }}
            ms
          </li>
        </ul>
      </div>
    );
  }
}

export function MainPopupFunc(
  performanceViewController: Controller,
  desModderController: DesModderController
): PerformanceView {
  return <PerformanceView controller={() => performanceViewController} desModderController={() => desModderController} />;
}
