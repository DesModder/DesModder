import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import applyText from "./down/applyText";
import getText from "./up/getText";
import { Diagnostic } from "@codemirror/lint";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;
  applyingUpdateFromGraph: boolean = false;
  applyingUpdateFromText: boolean = false;
  lastDiagnostics: Diagnostic[] = [];

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }

  mountEditor(container: HTMLDivElement) {
    this.view = initView(this);
    container.appendChild(this.view.dom);
    Calc.observeEvent("change.dsm-text-mode", () => this.updateFromGraph());
  }

  unmountEditor(container: HTMLDivElement) {
    Calc.unobserveEvent("change.dsm-text-mode");
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  /**
   * Linting is the entry point for linting but also for evaluation
   */
  doLint(view: EditorView): Diagnostic[] {
    if (!this.applyingUpdateFromGraph) {
      this.applyingUpdateFromText = true;
      const text = view.state.sliceDoc();
      this.lastDiagnostics = applyText(text);
      view.focus();
      this.applyingUpdateFromText = false;
    }
    return this.lastDiagnostics;
  }

  updateFromGraph() {
    // Update changes from user dragging point, slider/regression tick, etc.
    // TODO: incremental update
    if (!this.applyingUpdateFromText && this.view) {
      this.applyingUpdateFromGraph = true;
      const editorState = this.view.state;
      const text = getText();
      this.view.update([
        editorState.update({
          changes: { from: 0, to: editorState.doc.length, insert: text },
        }),
      ]);
      this.applyingUpdateFromGraph = false;
    }
  }
}
