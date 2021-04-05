import { refactor } from './backend'
import View from './View'
import window from 'globals/window'

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
      window.Calc.controller.getExpressionSearchStr(),
      this.replaceLatex
    )
  }
}
