import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import { pillboxButton } from "../pillbox-menus/facets/pillboxButtons";
import { MainPopupFunc } from "./PerformanceView";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { DispatchedEvent, TimingData } from "globals/Calc";
import { Calc } from "globals/window";

export default class PerformanceInfo extends CMPlugin {
  static id = "performance-info" as const;
  static enabledByDefault = false;

  timingDataHistory: TimingData[] = [];
  dispatchListenerID!: string;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    this.dispatchListenerID = Calc.controller.dispatcher.register((e) => {
      if (e.type === "on-evaluator-changes") {
        this.onEvaluatorChanges(e);
      }
    });
  }

  destroy() {
    Calc.controller.dispatcher.unregister(this.dispatchListenerID);
  }

  onEvaluatorChanges(e: DispatchedEvent) {
    if (e.type !== "on-evaluator-changes") return;
    this.timingDataHistory?.push(e.timingData);
    if (this.timingDataHistory.length > 10) this.timingDataHistory.shift();
    Calc.controller.updateViews();
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

export function performanceInfo(
  dsm: MainController
): CMPluginSpec<PerformanceInfo> {
  return {
    id: PerformanceInfo.id,
    config: [],
    category: "utility",
    plugin: ViewPlugin.define((view) => new PerformanceInfo(view, dsm), {
      provide: (plugin) => [
        pillboxButton.of({
          id: "dsm-pi-menu",
          tooltip: "performance-info-name",
          iconClass: "dsm-icon-pie-chart",
          popup: () => MainPopupFunc(dsm.view.plugin(plugin)!, dsm),
        }),
      ],
    }),
    extensions: [],
  };
}
