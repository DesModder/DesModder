import MainController from "../../main/Controller";
import { PluginController } from "../PluginController";
import { DispatchedEvent, TimingData } from "globals/Calc";
import { Calc } from "globals/window";

const defaultTimingData: TimingData = {
  cacheHits: 0,
  cacheMisses: 0,
  cacheReads: 0,
  cacheWrites: 0,
  timeInWorker: 0,
  updateAnalysis: 0,
  computeAllLabels: 0,
  computeAriaDescriptions: 0,
  graphAllChanges: 0,
  processStatements: 0,
  publishAllStatuses: 0,
  updateIntersections: 0,
};

export default class Controller extends PluginController {
  timingDataHistory: TimingData[] = [];
  dispatchListenerID: string;

  constructor(mainController: MainController) {
    super(mainController);
    this.dispatchListenerID = Calc.controller.dispatcher.register((e) => {
      if (e.type === "on-evaluator-changes") {
        this.onEvaluatorChanges(e);
      }
    });
  }

  onEvaluatorChanges(e: DispatchedEvent) {
    if (e.type !== "on-evaluator-changes") return;
    this.timingDataHistory?.push(e.timingData);
    if (this.timingDataHistory.length > 10) this.timingDataHistory.shift();
    this.controller.enabledPlugins.pillboxMenus?.updateExtraComponents();
  }

  getTimingData() {
    return (
      this.timingDataHistory[this.timingDataHistory.length - 1] ??
      defaultTimingData
    );
  }

  refreshState() {
    Calc.controller._showToast({ message: "Refreshing graph..." });
    Calc.setState(Calc.getState());
  }

  stop() {
    Calc.controller.dispatcher.unregister(this.dispatchListenerID);
  }
}
