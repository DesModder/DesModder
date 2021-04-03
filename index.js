import { initView, destroyView } from './view'

let dispatchListenerID

function onEnable () {
  dispatchListenerID = window.Calc.controller.dispatcher.register(
    ({ type }) => {
      if (type === 'open-expression-search') {
        initView()
      } else if (type === 'close-expression-search') {
        destroyView()
      }
      // may want to listen to update-expression-search-str
    }
  )
}

function onDisable () {
  window.Calc.controller.dispatcher.unregister(dispatchListenerID)
  destroyView()
}

export default {
  name: 'Find and Replace',
  description: 'Easily refactor variable names in Ctrl+F Menu',
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true
}
