import "./StyleCircle.less";
import { Component, DCGView, jsx } from "DCGView";
import { ExpressionIconView, ImageIconView } from "components";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";

export default class StyleCircle extends Component<{
  id: string;
  model: ItemModel;
}> {
  template() {
    const model = this.props.model();
    const type = model.type;
    switch (type) {
      case "expression":
        return (
          <ExpressionIconView
            model={DCGView.const(model)}
            controller={DCGView.const(Calc.controller)}
          />
        );
      case "image":
        return (
          <ImageIconView
            model={DCGView.const(model)}
            controller={DCGView.const(Calc.controller)}
          />
        );
      default:
        return <div></div>;
    }
  }
}
