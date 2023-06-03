import { PluginController } from "../PluginController";
import Controller from "./Controller";
import View from "./View";
import { Calc, Console } from "globals/window";
import { Plugin } from "plugins";

const controller = new Controller();
const view = new View();

controller.init(view);
view.init(controller);

let dispatchListenerID: string;

function tryInitView() {
  try {
    view.initView();
  } catch {
    Console.warn("Failed to initialize find-replace view");
  }
}

export default class FindReplace extends PluginController {
  static id = "find-and-replace" as const;
  static enabledByDefault = true;

  afterEnable() {
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

  afterDisable() {
    Calc.controller.dispatcher.unregister(dispatchListenerID);
    view.destroyView();
  }
}
FindReplace satisfies Plugin;
