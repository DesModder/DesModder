import { PluginController } from "../PluginController";
import { onCalcEvent, analysisStateField } from "./LanguageServer";
import { RelevantEvent, relevantEventTypes } from "./modify";
import getText from "./up/getText";
import { initView, startState } from "./view/editor";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { Plugin } from "plugins";
import { keys } from "utils/depUtils";

export default class TextMode extends PluginController {
  static id = "text-mode" as const;
  static enabledByDefault = false;
  static descriptionLearnMore =
    "https://github.com/DesModder/DesModder/tree/main/src/plugins/text-mode/docs/intro.md";

  inTextMode: boolean = false;
  view: EditorView | null = null;
  dispatchListenerID: string | null = null;

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
  mountEditor(container: HTMLDivElement) {
    const [hasError, text] = getText();
    this.view = initView(this, text);
    if (hasError) this.conversionError(() => this.toggleTextMode());
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = Calc.controller.dispatcher.register((event) => {
      if (event.type === "set-state" && !event.opts.fromTextMode)
        this.onSetState();
      if ((relevantEventTypes as readonly string[]).includes(event.type)) {
        // setTimeout to avoid dispatch-in-dispatch from handlers responding to
        // calc state changing by dispatching an event
        setTimeout(
          () => this.view && onCalcEvent(this.view, event as RelevantEvent),
          0
        );
      }
    });
  }

  onSetState() {
    const [hasError, text] = getText();
    this.view?.setState(startState(this, text));
    if (hasError) this.conversionError();
  }

  conversionError(undoCallback?: () => void) {
    Calc.controller._showToast({
      message:
        "Automatic conversion to text encountered errors in some expressions.",
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
  preventPropagation(container: HTMLDivElement) {
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
TextMode satisfies Plugin;
