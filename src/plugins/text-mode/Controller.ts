import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import applyCST from "./down/applyCST";
import getText from "./up/getText";
import { Diagnostic } from "@codemirror/lint";
import { keys } from "utils/depUtils";
import { ensureSyntaxTree } from "@codemirror/language";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;
  applyingUpdateFromGraph: boolean = false;
  applyingUpdateFromText: boolean = false;
  /** Is the initial doc being applying from initView()? */
  initialDoc: boolean = false;
  lastDiagnostics: Diagnostic[] = [];

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }

  mountEditor(container: HTMLDivElement) {
    this.initialDoc = true;
    this.view = initView(this);
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
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
   * Codemirror handles undo, redo, and Ctrl+/; we don't want Desmos to get
   * these, so we stop their propagation at the container
   */
  preventPropagation(container: HTMLDivElement) {
    container.addEventListener(
      "keydown",
      (e) =>
        (keys.isUndo(e) || keys.isRedo(e) || keys.isHelp(e)) &&
        e.stopPropagation()
    );
  }

  /**
   * Linting is the entry point for linting but also for evaluation
   */
  doLint(view: EditorView): Promise<Diagnostic[]> {
    return new Promise((resolve) => {
      if (this.initialDoc) {
        this.initialDoc = false;
        resolve(this.lastDiagnostics);
      } else if (!this.applyingUpdateFromGraph) {
        const stLoop = setInterval(() => {
          const state = view.state;
          const syntaxTree = ensureSyntaxTree(state, state.doc.length, 50);
          if (syntaxTree) {
            clearInterval(stLoop);
            console.log("Applying update from text");
            this.applyingUpdateFromText = true;
            this.lastDiagnostics = applyCST(syntaxTree, state.sliceDoc());
            view.focus();
            this.applyingUpdateFromText = false;
            resolve(this.lastDiagnostics);
          }
        }, 100);
      } else {
        resolve(this.lastDiagnostics);
      }
    });
  }

  updateFromGraph() {
    // Update changes from user dragging point, slider/regression tick, etc.
    // TODO: incremental update
    if (!this.applyingUpdateFromText && this.view) {
      this.applyingUpdateFromGraph = true;
      const editorState = this.view.state;
      const [errors, text] = getText();
      this.view.update([
        editorState.update({
          changes: { from: 0, to: editorState.doc.length, insert: text },
        }),
      ]);
      this.applyingUpdateFromGraph = false;
    }
  }
}
