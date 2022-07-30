import { Component, jsx } from "DCGView";
import Controller from "./Controller"
// import "./PerfomanceView.less";

export class PerformanceView extends Component <{
    controller: Controller;
}> {
    template() {
        return (
            <div class="dcg-popover-interior">
                <p><span style="font-weight: bold">Time In Worker:</span>{() => this.props.controller().getTimingData()?.timeInWorker ?? 0}ms</p>
            </div>
        )
    }
}

export function MainPopupFunc(performanceViewController: Controller): PerformanceView {
    return <PerformanceView controller={performanceViewController}/>;
}