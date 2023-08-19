import { PluginController } from "../PluginController";
import { facetSourcesSpec, facetsSpec } from "dataflow";
import { Calc } from "globals/window";

declare module "dataflow" {
  interface Facets {
    labelWithIds: {
      input: boolean;
      output: boolean;
    };
  }
}

export default class DebugMode extends PluginController {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  facets = facetsSpec({
    labelWithIds: {
      combine: (value) => value[0] ?? false,
    },
  });

  facetSources = facetSourcesSpec({
    labelWithIds: { value: true },
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
