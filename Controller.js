import { refactor } from './backend'

export default class Controller {
  constructor () {
    this.replaceLatex = ''
  }

  init (view) {
    this.view = view
  }

  getReplaceLatex () {
    return this.replaceLatex
  }

  setReplaceLatex (latex) {
    this.replaceLatex = latex
  }

  refactorAll () {
    refactor(
      window.Calc.controller.getExpressionSearchStr(),
      this.replaceLatex
    )
  }
}
