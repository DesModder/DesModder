import DCGView from 'DCGView'
import { MathQuillView } from 'components/desmosComponents'

const autoOperatorNames = window.require('main/mathquill-operators').getAutoOperators()

export default class ReplaceBar extends DCGView.Class {
  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='dcg-expression-search-bar'>
        <div class='dcg-search-mathquill-container'>
          <MathQuillView
            latex={() => this.controller.getReplaceLatex()}
            capExpressionSize={false}
            config={{
              autoOperatorNames
            }}
            isFocused={false}
            getAriaLabel='expression replace'
            getAriaPostLabel=''
            onUserChangedLatex={e => this.controller.setReplaceLatex(e)}
            onUserPressedKey={(key, s) => {
              if (key === 'Enter') {
                this.controller.refactorAll()
              } else if (key === 'Esc') {
                this.closeReplace()
              } else {
                const focusedMQ = MathQuillView.getFocusedMathquill()
                focusedMQ.keystroke(key, s)
                this.controller.setReplaceLatex(focusedMQ.latex())
              }
            }}
            onFocusedChanged={() => {}}
            hasError={false}
            selectOnFocus
            noFadeout
          />
          {/* dcg-icon-search applies placement + icon, and
            dcg-icon-caret-right overrides icon to be the caret */}
          <i class='dcg-icon-search dcg-icon-caret-right' />
          <i
            class='dcg-icon-remove dcg-do-not-blur'
            onTap={() => this.closeReplace()}
          />
        </div>
        <div
          class='dcg-search-clear'
          onTap={() => this.controller.refactorAll()}
        >
          replace all
        </div>
      </div>
    )
  }

  closeReplace () {
    window.Calc.controller.dispatch({
      type: 'close-expression-search'
    })
  }
}
