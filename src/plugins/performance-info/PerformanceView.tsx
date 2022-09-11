import { Button, IconButton, Tooltip } from "components";
import { Component, jsx } from "DCGView";
import Controller from "./Controller";
import DesModderController from "main/Controller";
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
              iconClass={"dsm-icon-bookmark"}
              onTap={() => {
                this.props.desModderController().toggleMenuPinned();
              }}
              btnClass={() => ({
                "dsm-pi-pin-menu-button": true,
                "dsm-selected":
                  this.props.desModderController().pillboxMenuPinned,
              })}
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
                timingData.timeInWorker -
                  (timingData.updateAnalysis + timingData.graphAllChanges)
              );
            }}
            ms
          </li>
        </ul>
        <div class="dsm-pi-refresh-state-button-container">
          <Tooltip tooltip="Refresh the graph state to measure first load performance">
            <Button
              color="primary"
              class="dsm-pi-refresh-state-button"
              onTap={() => {
                this.props.controller().refreshState();
              }}
            >
              Refresh Graph
            </Button>
          </Tooltip>
        </div>
      </div>
    );
  }
}

export function MainPopupFunc(
  performanceViewController: Controller,
  desModderController: DesModderController
): PerformanceView {
  return (
    <PerformanceView
      controller={() => performanceViewController}
      desModderController={() => desModderController}
    />
  );
}
