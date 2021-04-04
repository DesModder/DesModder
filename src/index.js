import Controller from 'Controller'
import View from 'View'
import { pollForValue } from 'utils'

const controller = new Controller()
const view = new View()

window.DesModder = {
  view,
  controller
}

pollForValue(() => window.Calc).then(() => {
  controller.init(view)
  view.init(controller)
})
