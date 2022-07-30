import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";
import { updateView } from "./View";
import { TimingData } from "globals/Calc";

let dispatchListenerID: string;

export default class Controller {
    lastTimingData: TimingData | null = null;
    constructor() {
        dispatchListenerID = Calc.controller.dispatcher.register((e) => {
            if (e.type === "on-evaluator-changes") {
                this.onEvaluatorChanges(e)
            }
        })
    }
    onEvaluatorChanges(e: DispatchedEvent) {
        if(e.type != "on-evaluator-changes") return
        this.lastTimingData = e.timingData
        updateView()
    }
    getTimingData() {
        return this.lastTimingData;
    }
    refreshState() {
        // TODO: When you make the css for this, use dcg-icon-reset
        Calc.setState(Calc.getState());
    }
}