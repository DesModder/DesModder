import { CMPluginSpec } from "..";
import MainController from "../../MainController";
import { CMPlugin, Inserter } from "../CMPlugin";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";
import { ViewPlugin } from "@codemirror/view";

export default class BetterEvaluationView extends CMPlugin<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;

  listEvaluation(val: () => string[]): Inserter {
    if (!this.settings.lists) return undefined;
    return () => ListEvaluation(val);
  }

  colorEvaluation(val: () => string | string[]): Inserter {
    const settings = this.settings;
    if (!settings.colors) return undefined;
    const isArray = Array.isArray(val());
    if (isArray && !(settings.lists && settings.colorLists)) return undefined;
    return () => ColorEvaluation(val);
  }
}

export function betterEvaluationView(
  dsm: MainController
): CMPluginSpec<BetterEvaluationView> {
  return {
    id: BetterEvaluationView.id,
    category: "visual",
    config: configList,
    plugin: ViewPlugin.define((view) => new BetterEvaluationView(view, dsm)),
    extensions: [],
  };
}
