import { Calc, DCGView, If, jquery } from "desmodder";
import tips, { TipData } from "./tips";
import "./Tip.less";

export default class Tip extends DCGView.Class {
  currentTip: TipData = this.randomTip();

  template() {
    return (
      <div class="dsm-usage-tip" onTap={() => this.nextTip()}>
        <div>{() => this.currentTip.desc}</div>
        <If predicate={() => this.currentTip?.learnMore !== undefined}>
          {() => (
            <a
              href={() => this.currentTip?.learnMore}
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

  randomTip() {
    return tips[Math.floor(Math.random() * tips.length)];
  }

  nextTip() {
    let nextTip = this.randomTip();
    while (nextTip === this.currentTip) {
      // Avoid repeating the same tip two times in a row
      nextTip = this.randomTip();
    }
    this.currentTip = nextTip;
    Calc.controller.updateViews();
  }
}

export function createTipElement() {
  return <Tip></Tip>;
}
