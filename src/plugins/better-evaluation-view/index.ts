import { IfElse } from "../../components";
import { Replacer } from "../../preload/replaceElement";
import { PluginController } from "../PluginController";
import "./better-evaluation-view.less";
import { ColorEvaluation } from "./components/ColorEvaluation";
import { ListEvaluation } from "./components/ListEvaluation";
import { Config, configList } from "./config";
import { facetSourcesSpec } from "dataflow";

declare module "dataflow" {
  interface Computed {
    bevListEvaluation: Replacer<string[]>;
    bevColorEvaluation: Replacer<string | string[]>;
  }
}

export default class BetterEvaluationView extends PluginController<Config> {
  static id = "better-evaluation-view" as const;
  static enabledByDefault = true;
  static config = configList;

  computed = facetSourcesSpec({
    bevListEvaluation: {
      value: (old, val) =>
        IfElse(() => this.settings.lists, {
          true: () => ListEvaluation(val),
          false: () => old(),
        }),
    },
    bevColorEvaluation: {
      value: (old, val) =>
        IfElse(
          () =>
            this.settings.colors &&
            (!Array.isArray(val) ||
              (this.settings.lists && this.settings.colorLists)),
          {
            true: () => ColorEvaluation(val, old()),
            false: () => old(),
          }
        ),
    },
  });
}
