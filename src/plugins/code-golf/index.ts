import { AllActions } from "src/globals/extra-actions";
import { Inserter, PluginController } from "../PluginController";
import { DispatchedEvent, ExpressionModel, FolderModel } from "src/globals";
import { populateGolfStats } from "./golf-model";
import { GolfStatsPanelFn } from "./GolfStatsPanel";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "code-golf": {
      type: "dsm-code-golf-enable-despite-length";
      id: string;
    };
  }
}

export default class CodeGolf extends PluginController {
  static id = "code-golf" as const;
  static enabledByDefault = false;

  expressionItemCostPanel(model: ExpressionModel): Inserter {
    return () => GolfStatsPanelFn(this.cc, model);
  }

  folderCostPanel(model: FolderModel): Inserter {
    return () => GolfStatsPanelFn(this.cc, model);
  }

  afterConfigChange(): void {}

  afterEnable() {}

  afterDisable() {}

  handleDispatchedAction(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-code-golf-enable-despite-length": {
        const item = this.cc.getItemModel(action.id);
        if (item) {
          item.dsmEnableGolfDespiteLength = true;
        }
        break;
      }
      default:
        // Tutorial: If a plugin declares a new action but doesn't handle it, then
        // the action simply does nothing. This `satisfies` statement ensures
        // that this plugin at least handles all the actions it declares.
        // Remember to change `"folder-tools"` to the actual plugin ID.
        action satisfies Exclude<DispatchedEvent, AllActions["code-golf"]>;
    }

    // This should really be in updateTheComputedWorld.
    // But that's okay, as long as it's before `updateViews` and after the
    // above changes. Desmos should be done with their `latex` mutation
    // by the end of their `handleDispatchedAction`, and ours runs after.
    populateGolfStats(this.cc);
    return undefined;
  }
}
