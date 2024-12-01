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
        action satisfies Exclude<DispatchedEvent, AllActions["code-golf"]>;
        break;
    }
    return undefined;
  }

  afterUpdateTheComputedWorld() {
    populateGolfStats(this.cc);
  }
}
