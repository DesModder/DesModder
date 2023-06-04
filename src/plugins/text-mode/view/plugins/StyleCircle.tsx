import "./StyleCircle.less";
import { Component, DCGView, jsx } from "DCGView";
import { ExpressionIconView } from "components";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";

export default class StyleCircle extends Component<{
  id: string;
  model: ItemModel;
}> {
  template() {
    return (
      <ExpressionIconView
        model={DCGView.const(this.props.model())}
        controller={DCGView.const(Calc.controller)}
      />
    );
  }
}
