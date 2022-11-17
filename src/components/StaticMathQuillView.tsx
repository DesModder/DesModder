import { DStaticMathquillView } from "./desmosComponents";
import { Component, jsx } from "DCGView";

export default class StaticMathquillView extends Component<{
  latex: string;
}> {
  template() {
    return <DStaticMathquillView latex={this.props.latex()} config={{}} />;
  }
}
