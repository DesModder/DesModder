import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import applyText from "./down/applyText";
import { printTree } from "./lezer/print-lezer-tree";
import { parser } from "./lezer/syntax.grammar";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }

  mountEditor(container: HTMLDivElement) {
    this.view = initView(this);
    container.appendChild(this.view.dom);
  }

  unmountEditor(container: HTMLDivElement) {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  handleUpdate(update: ViewUpdate) {
    if (this.view && update.docChanged) {
      const text = this.view.state.sliceDoc();
      console.groupCollapsed("Program");
      console.log(printTree(parser.parse(text), text));
      console.groupEnd();
      applyText(text);
      this.view.focus();
    }
  }
}
