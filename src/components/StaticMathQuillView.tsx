import { Component, jsx } from "DCGView";
import { DStaticMathquillView } from "./desmosComponents";

export default class StaticMathquillView extends Component<{
  latex: string;
}> {
  template() {
    return <DStaticMathquillView latex={this.props.latex()} config={{}} />;
  }
}
