import { Inserter, PluginController, Replacer } from "../PluginController";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;

  listEvaluation(val: Parameters<typeof ListEvaluation>[0]): Inserter {
    if (!this.settings.lists) return undefined;
    return () => ListEvaluation(val);
  }

  colorEvaluation(val: () => string | string[]): Replacer {
    const { settings } = this;
    if (!settings.colors) return undefined;
    const isArray = Array.isArray(val());
    if (isArray && !(settings.lists && settings.colorLists)) return undefined;
    return (swatch) => ColorEvaluation(val, swatch);
  }
}
