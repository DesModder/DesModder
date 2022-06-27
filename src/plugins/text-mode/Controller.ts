import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import { jquery, keys } from "utils/depUtils";
import { RelevantEvent, relevantEventTypes } from "./modify";
import LanguageServer from "./LanguageServer";
import getText from "./up/getText";
import { GraphState } from "@desmodder/graph-state";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;
  languageServer: LanguageServer | null = null;

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
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
      console.log("set state from text", state);
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
      if ((relevantEventTypes as readonly string[]).includes(event.type))
        this.languageServer!.onCalcEvent(event as RelevantEvent);
    });
  }

  /**
   * unmountEditor: called from module overrides when the DCGView node unmounts
   */
  unmountEditor(container: HTMLDivElement) {
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
    return this.languageServer.onEditorUpdate(update);
  }
}
