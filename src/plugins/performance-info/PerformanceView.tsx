import { Component, jsx } from "DCGView";
import { TimingData } from "globals/Calc";
import { Calc } from "globals/window";
import "./PerfomanceView.less";

export default class PerformanceView extends Component <{
    performanceInfo: TimingData;
}> {
    template() {
        return (
            <div class="dcg-performance-view">
                <p>{() => this.props.performanceInfo().timeInWorker}</p>
            </div>
        )
    }
}