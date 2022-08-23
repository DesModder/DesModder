import { Component, jsx } from "DCGView";
import { MathQuillView } from "./desmosComponents";

export default class SmallMathQuillInput extends Component<{
  autoOperatorNames?: string;
  ariaLabel: string;
  onUserChangedLatex: (s: string) => void;
  latex: string;
  hasError?: boolean;
  onFocusedChanged: (isFocused: boolean) => void;
  isFocused: boolean;
}> {
  template() {
    return (
      <MathQuillView
        isFocused={() => this.props.isFocused()}
        latex={() => this.props.latex()}
        capExpressionSize={80}
        config={{
          autoOperatorNames: this.getAutoOperatorNames(),
        }}
        getAriaLabel={() => this.props.ariaLabel()}
        getAriaPostLabel=""
        onUserChangedLatex={(s) => this.props.onUserChangedLatex(s)}
        onFocusedChanged={(isFocused) => this.props.onFocusedChanged(isFocused)}
        hasError={this.hasError()}
        selectOnFocus
        needsSystemKeypad={false}
      >
        <span
          class={() => ({
            "dcg-math-field": true,
            "dcg-math-input": true,
            "dcg-invalid": this.hasError(),
            "dcg-focus": this.props.isFocused(),
            "dcg-mq-focused": this.props.isFocused(),
          })}
          dcgDataLimit={40}
        />
      </MathQuillView>
    );
  }

  hasError() {
    return this.props.hasError ? this.props.hasError() : false;
  }

  getAutoOperatorNames() {
    const autoOperatorNames =
      this.props.autoOperatorNames && this.props.autoOperatorNames();
    return autoOperatorNames ? autoOperatorNames : "--";
  }
}
