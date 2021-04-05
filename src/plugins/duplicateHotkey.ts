// this is pretty much a template plugin
// based on userscript https://gist.github.com/jared-hughes/a21dbeead4c6d0969334707cc1a735bd

import window from 'globals/window'

import { jquery } from 'utils'
const keys = window.require('keys')

function onEnable () {
  jquery('.dcg-exppanel-outer').on('keydown.duplicateHotkey', (e: KeyboardEvent) => {
    if (e.ctrlKey && keys.lookupChar(e) === 'Q') {
      const Calc = window.Calc
      Calc.controller.dispatch({
        type: 'duplicate-expression',
        id: Calc.selectedExpressionId
      })
    }
  })
}

function onDisable () {
  jquery('.dcg-exppanel-outer').off('.duplicateHotkey')
}

export default {
  name: 'Duplicate Expression Hotkey',
  description: 'Press Ctrl+Q to duplicate the currently-selected expression',
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true
}
