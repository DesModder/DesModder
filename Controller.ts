import { refactor } from './backend'
import View from './View'
import { Calc } from 'desmodder'

export default class Controller {
  replaceLatex = ''
  view!: View

  init (view: View) {
    this.view = view
  }

  getReplaceLatex () {
    return this.replaceLatex
  }

  setReplaceLatex (latex: string) {
    this.replaceLatex = latex
  }

  refactorAll () {
    refactor(
      Calc.controller.getExpressionSearchStr(),
      this.replaceLatex
    )
  }

  focusSearch () {
    Calc.controller.dispatch({
      type: 'set-focus-location',
      location: {type: 'search-expressions'}
    })
  }
}
