import { Calc } from "globals/window";
import { If } from "components";
import { Component, jsx } from "DCGView";
import tips from "./tips";
import "./Tip.less";

export default class Tip extends Component {
  currentTipIndex!: number;

  init() {
    this.currentTipIndex = Math.floor(Math.random() * tips.length);
  }

  template() {
    return (
      <div class="dsm-usage-tip" onTap={() => this.nextTip()}>
        <div>{() => this.getCurrentTip().desc}</div>
        <If predicate={() => this.getCurrentTip().learnMore !== undefined}>
          {() => (
            <a
              href={() => this.getCurrentTip().learnMore}
              target="_blank"
              onTap={(e: MouseEvent) => e.stopPropagation()}
            >
              Learn more
            </a>
          )}
        </If>
      </div>
    );
  }

  getCurrentTip() {
    return tips[this.currentTipIndex];
  }

  nextTip() {
    this.currentTipIndex += 1;
    this.currentTipIndex %= tips.length;
    Calc.controller.updateViews();
  }
}

export function createTipElement() {
  return <Tip></Tip>;
}
