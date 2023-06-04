import { PluginController } from "../PluginController";
import "./better-evaluation-view.less";
import { Config, configList } from "./config";

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;
}
