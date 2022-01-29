import { EditorView, ViewUpdate } from "@codemirror/view";
import { ParseContext } from "@codemirror/language";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import applyText from "./down/applyText";

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
      const parseContext = ParseContext.get();
      console.log(parseContext);
      const text = this.view.state.sliceDoc();
      applyText(text);
      this.view.focus();
    }
  }
}
