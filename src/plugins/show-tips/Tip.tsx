import "./Tip.less";
import { getTipData } from "./tips";
import { Component, jsx } from "#DCGView";
import { If } from "#components";
import { format } from "#i18n";
import ShowTips from ".";

export default class Tip extends Component<{ st: ShowTips }> {
  currentTipIndex!: number;
  tips!: ReturnType<typeof getTipData>;

  init() {
    this.tips = getTipData();
    this.currentTipIndex = Math.floor(Math.random() * this.tips.length);
  }

  template() {
    return (
      <div class="dsm-usage-tip" onTap={() => this.nextTip()}>
        <div>{() => format(this.getCurrentTip().tip)}</div>
        <If predicate={() => this.getCurrentTip().learnMore !== ""}>
          {() => (
            <a
              href={() => this.getCurrentTip().learnMore}
              target="_blank"
              onTap={(e: MouseEvent) => e.stopPropagation()}
            >
              {() => format("menu-learn-more")}
            </a>
          )}
        </If>
      </div>
    );
  }

  getCurrentTip() {
    return this.tips[this.currentTipIndex];
  }

  nextTip() {
    this.currentTipIndex += 1;
    this.currentTipIndex %= this.tips.length;
    this.props.st().cc.dispatch({ type: "tick" });
  }
}
