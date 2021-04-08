import Controller from './Controller'
import View from './View'

let view: View
let controller: Controller

function onEnable () {
  controller = new Controller()
  view = new View(controller)
  controller.init(view)
  view.initView() // async
}

function onDisable () {
  view.destroyView()
}

export default {
  name: 'GIF Creator',
  description: 'Easily export GIFs',
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true
}
