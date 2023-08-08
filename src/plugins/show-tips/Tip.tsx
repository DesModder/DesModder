import "./Tip.less";
import { getTipData } from "./tips";
import { Component, jsx } from "DCGView";
import { If } from "components";
import { Calc } from "globals/window";
import { format } from "i18n/i18n-core";

export default class Tip extends Component {
  currentTipIndex!: number;
  tips!: ReturnType<typeof getTipData>;

  init() {
    this.tips = getTipData();
    this.currentTipIndex = Math.floor(Math.random() * this.tips.tipKeys.length);
  }

  template() {
    if (this.tips.tipKeys.length === 0) return <div></div>;

    return (
      <div class="dsm-usage-tip" onTap={() => this.nextTip()}>
        <div>{() => format(this.getCurrentTipKey())}</div>
        <If predicate={() => this.getCurrentLearnMore() !== undefined}>
          {() => (
            <a
              href={() => this.getCurrentLearnMore()}
              target="_blank"
              onTap={(e: MouseEvent) => e.stopPropagation()}
            >
              {format("menu-learn-more")}
            </a>
          )}
        </If>
      </div>
    );
  }

  getCurrentTipKey() {
    return this.tips.tipKeys[this.currentTipIndex];
  }

  getCurrentLearnMore() {
    return this.tips.learnMore[this.tips.tipKeys[this.currentTipIndex]];
  }

  nextTip() {
    this.currentTipIndex += 1;
    this.currentTipIndex %= this.tips.tipKeys.length;
    Calc.controller.updateViews();
  }
}
