import Controller from "./Controller";
import View from "./View";
import { Calc } from "globals/window";

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
  return controller;
}

function onDisable() {
  Calc.controller.dispatcher.unregister(dispatchListenerID);
  view.destroyView();
}

export default {
  id: "find-and-replace",
  onEnable,
  onDisable,
  enabledByDefault: true,
} as const;
