import { buildConfigFromGlobals, rawToText } from "../../../text-mode-core";
import { DCGView } from "../../DCGView";
import { Inserter, PluginController } from "../PluginController";
import { onCalcEvent, analysisStateField, tmPlugin } from "./LanguageServer";
import { TextModeToggle } from "./components/TextModeToggle";
import { initView, startState } from "./view/editor";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { keys } from "#utils/depUtils.ts";
import { AllActions, DispatchedEvent } from "src/globals/extra-actions";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "text-mode": {
      type: "dsm-text-mode-toggle";
      /** If true, toggle on. If false, toggle off.
       * If undefined, toggle to opposite of current state. */
      inTextMode?: boolean;
    };
  }
}

export default class TextMode extends PluginController {
  static id = "text-mode" as const;
  static enabledByDefault = false;
  static descriptionLearnMore = "https://www.desmodder.com/text-mode";

  inTextMode: boolean = false;
  /**
   * Life cycle:
   * 1. `inTextMode = false` and `isEditorMounted = false`
   * 2. User clicks toggle button, dispatches `dsm-text-mode-toggle`,
   *    which sets `inTextMode = true`.
   * 3. DCGView mounts the panel div, triggering `didMount` and starting a timeout.
   * 4. Timeout runs, mounting editor (setting `isEditorMounted = true`)
   *    which runs a setState. Timeout was needed to avoid
   *    dispatch-in-dispatch from the setState.
   * 5. User clicks toggle button, dispatches `dsm-text-mode-toggle`,
   *    which sets `inTextMode = false`.
   * 6. DCGView unmounts the panel div, triggering `willUnmount`,
   *    which sets `isEditorMounted = false`.
   */
  isEditorMounted: boolean = false;
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;

  afterDisable() {
    if (this.inTextMode) {
      this.toggleTextModeOff();
    }
  }

  afterUpdateTheComputedWorld() {
    if (this.inTextMode) {
      for (const m of this.cc.getAllItemModels()) {
        m.isHiddenFromUI = true;
      }
    }
  }

  handleDispatchedAction(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-text-mode-toggle": {
        const newInTextMode = action.inTextMode ?? !this.inTextMode;
        if (newInTextMode === this.inTextMode) break;
        if (newInTextMode) {
          this.toggleTextModeOn();
        } else {
          this.toggleTextModeOff();
        }
        break;
      }
      default:
        action satisfies Exclude<DispatchedEvent, AllActions["text-mode"]>;
    }
    return undefined;
  }

  toggleTextModeOn() {
    this.inTextMode = true;
    // Ticks update rendering, and they process sliders. Since the existing
    // expression UI doesn't render in text mode, we replace markTickRequiredNextFrame
    // with a version that calls markTickRequiredNextFrame only when sliders are playing
    this.cc.expressionSearchOpen = false;
    this.cc.markTickRequiredNextFrame = function () {
      if (this.getPlayingSliders().length > 0) {
        // eslint-disable-next-line no-proto
        (this as any).__proto__.markTickRequiredNextFrame.apply(this);
      }
    };
  }

  toggleTextModeOff() {
    this.inTextMode = false;
    // Revert back to the old markTickRequiredNextFrame given by prototype
    delete (this.cc as any).markTickRequiredNextFrame;
  }

  abortScrollListenerController = new AbortController();

  /**
   * mountEditor: called from module overrides when the DCGView node mounts
   */
  mountEditor(container: HTMLElement) {
    const [hasError, text] = this.getText();
    this.view = initView(this, text);
    this.view.scrollDOM.addEventListener(
      "scroll",
      () => this.cc.dispatch({ type: "close-item-settings-menu" }),
      { signal: this.abortScrollListenerController.signal }
    );
    if (hasError)
      this.conversionError(() =>
        this.cc.dispatch({ type: "dsm-text-mode-toggle", inTextMode: false })
      );
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
    this.isEditorMounted = true;
  }

  /**
   * unmountEditor: called from module overrides when the DCGView node unmounts
   */
  unmountEditor() {
    if (!this.isEditorMounted) return;
    this.isEditorMounted = false;
    this.dispatchListenerID = null;
    if (this.dispatchListenerID !== null) {
      this.cc.dispatcher.unregister(this.dispatchListenerID);
    }
    if (this.view) {
      this.abortScrollListenerController.abort();
      this.view.destroy();
      this.view = null;
    }
  }

  editorPanel(): Inserter {
    if (!this.inTextMode) return undefined;
    return () =>
      DCGView.createElement("div", {
        class: DCGView.const("dsm-text-editor-container"),
        didMount: (div) =>
          // setTimeout to avoid a dispatch-in-dispatch arising from
          // mountEditor doing a `setState` to ensure sync correctness.
          setTimeout(() => this.inTextMode && this.mountEditor(div), 0),
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
    this.cc.showToast({
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
  const { calc } = view.state.facet(tmPlugin);
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
