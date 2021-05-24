import Controller from "./Controller";
import View from "./View";
import { Calc } from "desmodder";

const controller = new Controller();
const view = new View();

controller.init(view);
view.init(controller);

let dispatchListenerID: string;

function tryInitView() {
  try {
    view.initView();
  } catch {
    console.warn("Failed to initialize find-replace view");
  }
}

function onEnable() {
  if (Calc.controller.getExpressionSearchOpen()) {
    tryInitView();
  }
  dispatchListenerID = Calc.controller.dispatcher.register(({ type }) => {
    if (type === "open-expression-search") {
      tryInitView();
    } else if (type === "close-expression-search") {
      view.destroyView();
    }
    // may want to listen to update-expression-search-str
  });
}

function onDisable() {
  Calc.controller.dispatcher.unregister(dispatchListenerID);
  view.destroyView();
}

export default {
  id: "find-and-replace",
  name: "Find and Replace",
  description:
    'Adds a "replace all" button in the Ctrl+F Menu to let you easily refactor variable/function names.',
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
