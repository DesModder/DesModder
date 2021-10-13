import { Calc, DCGView } from "desmodder";
import tips from "./tips";
import "./Tip.less";

export default class Tip extends DCGView.Class {
  currentTip: string = this.randomTip();

  template() {
    return (
      <div class="dsm-usage-tip" onTap={() => this.nextTip()}>
        {() => this.currentTip}
      </div>
    );
  }

  randomTip() {
    return tips[Math.floor(Math.random() * tips.length)];
  }

  nextTip() {
    this.currentTip = this.randomTip();
    Calc.controller.updateViews();
  }
}

export function createTipElement() {
  console.log("creating tip element");
  return <Tip></Tip>;
}
