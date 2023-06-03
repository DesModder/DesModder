import { PluginController } from "../PluginController";
import "./better-evaluation-view.less";
import { configList } from "./config";
import { Plugin } from "plugins";

export default class BetterEvaluationView extends PluginController {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;
}
BetterEvaluationView satisfies Plugin;
