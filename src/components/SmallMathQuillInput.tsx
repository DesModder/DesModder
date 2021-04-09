import DCGView from 'DCGView'
import { MathQuillView } from './desmosComponents'

export default class SmallMathQuillInput extends DCGView.Class<{
  autoOperatorNames?: string,
  ariaLabel: string,
  onUserChangedLatex: (s: string) => void,
  latex: string,
  hasError?: boolean
}> {
  template () {
    return (
      <MathQuillView
        isFocused={false}
        latex={this.props.latex()}
        capExpressionSize={80}
        config={{
          autoOperatorNames: this.getAutoOperatorNames()
        }}
        getAriaLabel={() => this.props.ariaLabel()}
        getAriaPostLabel=''
        onUserChangedLatex={s => this.props.onUserChangedLatex(s)}
        onFocusedChanged={() => {}}
        onUserPressedKey={(key: string, e: KeyboardEvent) => {
          const focusedMQ = MathQuillView.getFocusedMathquill()
          focusedMQ.keystroke(key, e)
        }}
        hasError={this.hasError()}
        selectOnFocus
        needsSystemKeypad={false}
      >
        <span
          class={() => ({
            'dcg-math-field': true,
            'dcg-math-input': true,
            'dcg-invalid': this.hasError(),
            'dcg-focus': false
          })}
          dcgDataLimit={40}
        />
      </MathQuillView>
    )
  }

  hasError () {
    return this.props.hasError ? this.props.hasError(): false
  }

  getAutoOperatorNames() {
    const autoOperatorNames = this.props.autoOperatorNames && this.props.autoOperatorNames()
    return autoOperatorNames ? autoOperatorNames : '--'
  }
}
