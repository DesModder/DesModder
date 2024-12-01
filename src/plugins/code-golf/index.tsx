import { Component, jsx } from "#DCGView";
import { AllActions } from "src/globals/extra-actions";
import { Inserter, PluginController } from "../PluginController";
import "./index.less";
import { format } from "localization/i18n-core";
import { If, IfElse } from "src/components";
import {
  CalcController,
  DispatchedEvent,
  ExpressionModel,
  FolderModel,
  ItemModel,
} from "src/globals";
import { populateGolfStats, GolfStats, GoodGolfStats } from "./golf-model";

function _displayStats(stats: GolfStats | undefined): GoodGolfStats {
  if (!stats || stats === "TOO_LONG" || stats === "HIDDEN") {
    return { width: 0, symbols: 0 };
  } else {
    return stats;
  }
}

function areStatsUseful(stats: GolfStats | undefined): boolean {
  const { width, symbols } = _displayStats(stats);
  return width > 0 && symbols > 0;
}

function displayStats(stats: GolfStats | undefined) {
  const { width, symbols } = _displayStats(stats);
  return {
    width: format("code-golf-width-in-pixels", {
      pixels: Math.round(width).toString(),
    }),
    symbols: format("code-golf-symbol-count", {
      elements: symbols.toString(),
    }),
  };
}

class GolfStatsPanel extends Component<{
  cc: () => CalcController;
  model: () => ItemModel;
}> {
  template() {
    return (
      <div class="dsm-code-golf-char-count-container">
        {IfElse(() => !this.isDisabled(), {
          true: () => (
            <If
              predicate={() => areStatsUseful(this.props.model().dsmGolfStats)}
            >
              {() => (
                <div class="dsm-code-golf-char-count-container">
                  <div class="dsm-code-golf-char-count">
                    <div>{() => this.displayedStats().width}</div>
                    <div>{() => this.displayedStats().symbols}</div>
                  </div>
                </div>
              )}
            </If>
          ),
          false: () => (
            <div
              class="dsm-code-golf-char-count dsm-clickable"
              onClick={() => {
                this.props.cc().dispatch({
                  type: "dsm-code-golf-enable-despite-length",
                  id: this.props.model().id,
                });
              }}
            >
              {format("code-golf-click-to-enable-folder")}
            </div>
          ),
        })}
      </div>
    );
  }

  private isDisabled() {
    const model = this.props.model();
    return model.dsmGolfStats === "TOO_LONG";
  }

  private displayedStats() {
    return displayStats(this.props.model().dsmGolfStats);
  }
}

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
    return () => <GolfStatsPanel cc={() => this.cc} model={() => model} />;
  }

  folderCostPanel(model: FolderModel): Inserter {
    return () => <GolfStatsPanel cc={() => this.cc} model={() => model} />;
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
  }
}
