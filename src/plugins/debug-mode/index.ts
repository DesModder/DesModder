import { PluginController } from "../PluginController";
import { facetSourcesSpec, facetsSpec } from "dataflow";
import { Calc } from "globals/window";

declare module "dataflow" {
  interface Facets {
    "label-with-ids": {
      input: boolean;
      output: boolean;
    };
  }
}

export default class DebugMode extends PluginController {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  facets = facetsSpec({
    "label-with-ids": {
      combine: (value) => value[0] ?? false,
    },
  });

  facetSources = facetSourcesSpec({
    "label-with-ids": { value: true },
  });

  afterEnable() {
    // The displayed indexes are stored in some state somewhere, so
    // update the state first before updating views
    Calc.controller.updateTheComputedWorld();
  }

  afterDisable() {
    Calc.controller.updateTheComputedWorld();
  }
}
