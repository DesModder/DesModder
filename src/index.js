import Controller from 'Controller'
import View from 'View'

const controller = new Controller()
const view = new View()

window.DesModder = {
  view,
  controller
}

controller.init(view)
view.init(controller) // .then(...) <- init is async
