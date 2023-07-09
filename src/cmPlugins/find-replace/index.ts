import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import Controller from "./Controller";
import View from "./View";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc, Console } from "globals/window";

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

export default class FindReplace extends CMPlugin {
  static id = "find-and-replace" as const;
  static enabledByDefault = true;

  constructor(_view: EditorView, dsm: MainController) {
    super(_view, dsm);
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

  destroy() {
    Calc.controller.dispatcher.unregister(dispatchListenerID);
    view.destroyView();
  }
}

export function findReplace(dsm: MainController): CMPluginSpec<FindReplace> {
  return {
    id: FindReplace.id,
    category: "utility",
    config: [],
    plugin: ViewPlugin.define((view) => new FindReplace(view, dsm)),
    extensions: [],
  };
}
