import { Inserter, PluginController } from "../PluginController";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;
  static category = "visual";

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
