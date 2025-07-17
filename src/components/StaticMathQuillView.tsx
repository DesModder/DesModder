import { DStaticMathquillView, MathQuillConfig } from "./desmosComponents";
import { Component, jsx } from "#DCGView";

export default class StaticMathquillView extends Component<{
  latex: string;
  config?: MathQuillConfig;
}> {
  template() {
    return (
      <DStaticMathquillView
        latex={() => this.props.latex()}
        config={() => this.props.config?.() ?? {}}
      />
    );
  }
}
