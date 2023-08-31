import { buildConfigFromGlobals, rawToText } from "#text-mode-core";
import { onCalcEvent, analysisStateField } from "./LanguageServer";
import { initView, setDebugMode, startState } from "./view/editor";
import { TransactionSpec } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "#globals";
import { keys } from "#utils/depUtils";

export class TextModeEditor {
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;
  debugMode: boolean = false;

  setDebugMode(debugMode: boolean) {
    this.debugMode = debugMode;
    this.view?.dispatch(this.setDebugModeTransaction());
  }

  setDebugModeTransaction(): TransactionSpec {
    return {
      effects: setDebugMode.of(this.debugMode),
    };
  }

  mount(
    container: HTMLElement,
    { conversionErrorUndo }: { conversionErrorUndo?: () => void } = {}
  ) {
    const [hasError, text] = getText();
    this.view = initView(this, text);
    if (hasError) this.conversionError(() => conversionErrorUndo?.());
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = Calc.controller.dispatcher.register((event) => {
      // setTimeout to avoid dispatch-in-dispatch from handlers responding to
      // calc state changing by dispatching an event
      setTimeout(() => {
        if (event.type === "set-state" && !event.opts.fromTextMode)
          this.onSetState();
        if (this.view) onCalcEvent(this.view, event);
      });
    });
  }

  unmount() {
    if (this.dispatchListenerID !== null) {
      Calc.controller.dispatcher.unregister(this.dispatchListenerID);
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  onSetState() {
    const [hasError, text] = getText();
    this.view?.setState(startState(this, text));
    if (hasError) this.conversionError();
  }

  conversionError(undoCallback?: () => void) {
    this.toastError(
      "Automatic conversion to text encountered errors in some expressions.",
      undoCallback
    );
  }

  toastErrorGraphUndo(msg: string) {
    this.toastError(msg, () => Calc.controller.dispatch({ type: "undo" }));
  }

  toastError(msg: string, undoCallback?: () => void) {
    Calc.controller._showToast({
      message: msg,
      // `undoCallback: undefined` still adds the "Press Ctrl+Z" message
      ...(undoCallback ? { undoCallback } : {}),
    });
  }

  /**
   * Codemirror handles undo, redo, and Ctrl+/; we don't want Desmos to receive
   * these, so we stop their propagation at the container
   */
  preventPropagation(container: HTMLElement) {
    // TDOO: may be able to just add `stopPropagation: true`, then you don't need Keys.
    container.addEventListener(
      "keydown",
      (e) =>
        (keys.isUndo(e) || keys.isRedo(e) || keys.isHelp(e)) &&
        e.stopPropagation()
    );
  }

  onEditorUpdate(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) selectFromText(update.view);
  }
}

function getText() {
  return rawToText(getTextModeConfig(), Calc.getState());
}

export function getTextModeConfig() {
  return buildConfigFromGlobals(Desmos, Calc);
}

function selectFromText(view: EditorView) {
  const currSelected = Calc.selectedExpressionId as string | undefined;
  const newSelected = getSelectedItem(view);
  if (newSelected !== currSelected) {
    if (view.hasFocus && newSelected !== undefined) {
      Calc.controller.dispatch({
        type: "set-selected-id",
        id: newSelected,
        dsmFromTextModeSelection: true,
      });
    } else {
      Calc.controller.dispatch({
        type: "set-none-selected",
      });
    }
  }
}

function getSelectedItem(view: EditorView): string | undefined {
  const analysis = view.state.field(analysisStateField);
  const selection = view.state.selection.main;
  if (analysis) {
    const containingPairs = Object.entries(analysis.mapIDstmt).filter(
      ([_id, stmt]) =>
        stmt.type !== "Folder" &&
        stmt.pos.from <= selection.from &&
        stmt.pos.to >= selection.to
    );
    return containingPairs[0]?.[0];
  }
}
