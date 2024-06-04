import { buildConfigFromGlobals, rawToText } from "../../../text-mode-core";
import { DCGView } from "../../DCGView";
import { Inserter, PluginController } from "../PluginController";
import { onCalcEvent, analysisStateField, tmPlugin } from "./LanguageServer";
import { TextModeToggle } from "./components/TextModeToggle";
import { initView, setDebugMode, startState } from "./view/editor";
import { TransactionSpec } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
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
      this.cc.expressionSearchOpen = false;
      this.cc.markTickRequiredNextFrame = function () {
        if (this.getPlayingSliders().length > 0) {
          // eslint-disable-next-line no-proto
          (this as any).__proto__.markTickRequiredNextFrame.apply(this);
        }
      };
    } else {
      // Revert back to the old markTickRequiredNextFrame given by prototype
      delete (this.cc as any).markTickRequiredNextFrame;
    }
    this.cc.dispatch({ type: "tick" });
  }

  /**
   * mountEditor: called from module overrides when the DCGView node mounts
   */
  mountEditor(container: HTMLElement) {
    const [hasError, text] = this.getText();
    this.view = initView(this, text);
    if (hasError) this.conversionError(() => this.toggleTextMode());
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = this.cc.dispatcher.register((event) => {
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
    if (this.cc.isInEditListMode()) return undefined;
    return () => TextModeToggle(this);
  }

  onSetState() {
    const [hasError, text] = this.getText();
    this.view?.setState(startState(this, text));
    if (hasError) this.conversionError();
  }

  getText() {
    return rawToText(this.getTextModeConfig(), this.calc.getState());
  }

  conversionError(undoCallback?: () => void) {
    this.toastError(
      "Automatic conversion to text encountered errors in some expressions.",
      undoCallback
    );
  }

  toastErrorGraphUndo(msg: string) {
    this.toastError(msg, () => this.cc.dispatch({ type: "undo" }));
  }

  toastError(msg: string, undoCallback?: () => void) {
    this.cc._showToast({
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
      this.cc.dispatcher.unregister(this.dispatchListenerID);
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

  getTextModeConfig() {
    return buildConfigFromGlobals(Desmos, this.calc);
  }
}

function selectFromText(view: EditorView) {
  const calc = view.state.facet(tmPlugin).calc;
  const currSelected = calc.selectedExpressionId as string | undefined;
  const newSelected = getSelectedItem(view);
  if (newSelected !== currSelected) {
    if (view.hasFocus && newSelected !== undefined) {
      calc.controller.dispatch({
        type: "set-selected-id",
        id: newSelected,
        dsmFromTextModeSelection: true,
      });
    } else {
      calc.controller.dispatch({
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
