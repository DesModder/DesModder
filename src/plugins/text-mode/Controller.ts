import LanguageServer from "./LanguageServer";
import { RelevantEvent, relevantEventTypes } from "./modify";
import getText from "./up/getText";
import { initView } from "./view/editor";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { Calc } from "globals/window";
import { jquery, keys } from "utils/depUtils";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;
  languageServer: LanguageServer | null = null;

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    // Ticks update rendering, and they process sliders. Since the existing
    // expression UI doesn't render in text mode, we replace markTickRequiredNextFrame
    // with a version that calls markTickRequiredNextFrame only when sliders are playing
    if (this.inTextMode) {
      Calc.controller.dispatch({ type: "close-expression-search" });
      Calc.controller.markTickRequiredNextFrame = function () {
        if (this.getPlayingSliders().length > 0) {
          // eslint-disable-next-line no-proto
          (this as any).__proto__.markTickRequiredNextFrame.apply(this);
        }
      };
    } else {
      // Revert back to the old markTickRequiredNextFrame given by prototype
      delete (Calc.controller as any).markTickRequiredNextFrame;
    }
    Calc.controller.updateViews();
  }

  /**
   * mountEditor: called from module overrides when the DCGView node mounts
   */
  mountEditor(container: HTMLDivElement) {
    /** TODO: getText as a pure function of Calc state */
    const [hasError, text] = getText();
    this.view = initView(this, text);
    this.languageServer = new LanguageServer(this.view, (state: GraphState) => {
      // Prevent Desmos from blurring the currently active element via
      //   jquery(document.activeElement).trigger("blur")
      // Alternative method this.view.focus() after setState does not prevent
      //   the current autocomplete tooltip from disappearing
      const trigger = jquery.prototype.trigger;
      jquery.prototype.trigger = () => [];
      Calc.setState(state, { allowUndo: true });
      jquery.prototype.trigger = trigger;
    });
    if (hasError)
      Calc.controller._showToast({
        message:
          "Automatic conversion to text encountered errors in some expressions.",
        undoCallback: () => {
          this.toggleTextMode();
        },
      });
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = Calc.controller.dispatcher.register((event) => {
      if ((relevantEventTypes as readonly string[]).includes(event.type)) {
        // setTimeout to avoid dispatch-in-dispatch from handlers responding to
        // calc state changing by dispatching an event
        setTimeout(
          () => this.languageServer!.onCalcEvent(event as RelevantEvent),
          0
        );
      }
    });
  }

  /**
   * unmountEditor: called from module overrides when the DCGView node unmounts
   */
  unmountEditor() {
    if (this.dispatchListenerID !== null) {
      Calc.controller.dispatcher.unregister(this.dispatchListenerID);
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
      this.languageServer!.destroy();
    }
  }

  /**
   * Codemirror handles undo, redo, and Ctrl+/; we don't want Desmos to receive
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

  doLint() {
    if (!this.languageServer) return [];
    return this.languageServer.doLint();
  }

  onEditorUpdate(update: ViewUpdate) {
    if (!this.languageServer) return;
    if (update.docChanged || update.selectionSet)
      selectFromText(update.view, this.languageServer);
    this.languageServer.onEditorUpdate(update);
  }
}

function selectFromText(view: EditorView, ls: LanguageServer) {
  const currSelected = Calc.selectedExpressionId as string | undefined;
  const newSelected = getSelectedItem(view, ls);
  if (newSelected !== currSelected) {
    if (newSelected !== undefined) {
      Calc.controller.dispatch({
        type: "set-selected-id",
        id: newSelected,
      });
    } else {
      Calc.controller.dispatch({
        type: "set-none-selected",
      });
    }
  }
}

function getSelectedItem(
  view: EditorView,
  ls: LanguageServer
): string | undefined {
  const selection = view.state.selection.main;
  if (ls.analysis) {
    const containingPairs = Object.entries(ls.analysis.mapIDstmt).filter(
      ([_id, stmt]) =>
        stmt!.type !== "Folder" &&
        stmt!.pos!.from <= selection.from &&
        stmt!.pos!.to >= selection.to
    );
    return containingPairs[0]?.[0];
  }
}
