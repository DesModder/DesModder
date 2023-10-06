import { buildConfigFromGlobals, rawToText } from "../../../text-mode-core";
import { DCGView } from "../../DCGView";
import { Inserter, PluginController } from "../PluginController";
import { onCalcEvent, analysisStateField } from "./LanguageServer";
import { TextModeToggle } from "./components/TextModeToggle";
import { initView, setDebugMode, startState } from "./view/editor";
import { TransactionSpec } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "#globals";
import { keys } from "#utils/depUtils.ts";

export default class TextMode extends PluginController {
  static id = "text-mode" as const;
  static enabledByDefault = false;
  static descriptionLearnMore = "https://www.desmodder.com/text-mode";

  inTextMode: boolean = false;
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;

  updateDebugMode() {
    this.view?.dispatch(this.updateDebugModeTransaction());
  }

  updateDebugModeTransaction(): TransactionSpec {
    return {
      effects: setDebugMode.of(this.dsm.isPluginEnabled("debug-mode")),
    };
  }

  afterDisable() {
    if (this.inTextMode) this.toggleTextMode();
  }

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    // Ticks update rendering, and they process sliders. Since the existing
    // expression UI doesn't render in text mode, we replace markTickRequiredNextFrame
    // with a version that calls markTickRequiredNextFrame only when sliders are playing
    if (this.inTextMode) {
      Calc.controller.expressionSearchOpen = false;
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
  mountEditor(container: HTMLElement) {
    const [hasError, text] = getText();
    this.view = initView(this, text);
    if (hasError) this.conversionError(() => this.toggleTextMode());
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

  editorPanel(): Inserter {
    if (!this.inTextMode) return undefined;
    return () =>
      DCGView.createElement("div", {
        class: DCGView.const("dsm-text-editor-container"),
        didMount: (div) => this.mountEditor(div),
        willUnmount: () => this.unmountEditor(),
      });
  }

  textModeToggle(): Inserter {
    if (Calc.controller.isInEditListMode()) return undefined;
    return () => TextModeToggle(this);
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
   * unmountEditor: called from module overrides when the DCGView node unmounts
   */
  unmountEditor() {
    if (this.dispatchListenerID !== null) {
      Calc.controller.dispatcher.unregister(this.dispatchListenerID);
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  /**
   * Codemirror handles undo, redo, and Ctrl+/; we don't want Desmos to receive
   * these, so we stop their propagation at the container
   */
  preventPropagation(container: HTMLElement) {
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
