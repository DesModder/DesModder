import { facetSourcesSpec } from "../../dataflow";
import { PluginController } from "../PluginController";
import { MainPopupFunc } from "./PerformanceView";
import { DispatchedEvent, TimingData } from "globals/Calc";
import { Calc } from "globals/window";

export default class PerformanceInfo extends PluginController {
  static id = "performance-info" as const;
  static enabledByDefault = false;

  timingDataHistory: TimingData[] = [];
  dispatchListenerID!: string;

  facetSources = facetSourcesSpec({
    pillboxButtons: {
      value: {
        id: "dsm-pi-menu",
        tooltip: "performance-info-name",
        iconClass: "dsm-icon-pie-chart",
        popup: () => MainPopupFunc(this, this.dsm),
      },
    },
  });

  afterEnable() {
    this.dispatchListenerID = Calc.controller.dispatcher.register((e) => {
      if (e.type === "on-evaluator-changes") {
        this.onEvaluatorChanges(e);
      }
    });
  }

  afterDisable() {
    Calc.controller.dispatcher.unregister(this.dispatchListenerID);
  }

  onEvaluatorChanges(e: DispatchedEvent) {
    if (e.type !== "on-evaluator-changes") return;
    this.timingDataHistory?.push(e.timingData);
    if (this.timingDataHistory.length > 10) this.timingDataHistory.shift();
    // Don't Calc.controller.updateViews here. This is inside a dispatched event,
    // so it will update views anyways.
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
}

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
