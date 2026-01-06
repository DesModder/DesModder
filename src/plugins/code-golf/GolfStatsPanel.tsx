import { Component, jsx } from "#DCGView";
import "./GolfStatsPanel.less";
import { format } from "localization/i18n-core";
import { CalcController, ItemModel } from "src/globals";
import { GolfStats, GoodGolfStats } from "./golf-model";
import { If, IfElse } from "../../components";
import window from "#globals";

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

export class GolfStatsPanel extends Component<{
  cc: () => CalcController;
  model: () => ItemModel;
}> {
  template() {
    return (
      <div class="dsm-code-golf-char-count-container">
        {IfElse(() => !this.isDisabled(), {
          true: () => (
            <If
              predicate={() =>
                // We always need to show stats for folders because drag-drop
                // can change the stats for the folders.
                this.props.model().type === "folder" ||
                areStatsUseful(this.props.model().dsmGolfStats)
              }
            >
              {() => (
                <div class="dsm-code-golf-char-count-container">
                  <div class="dsm-code-golf-char-count">
                    <If
                      predicate={() =>
                        !!window.DSM.codeGolf?.settings.showWidth
                      }
                    >
                      {() => <div>{() => this.displayedStats().width}</div>}
                    </If>
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

export function GolfStatsPanelFn(cc: CalcController, model: ItemModel) {
  return <GolfStatsPanel cc={() => cc} model={() => model} />;
}
