import { EditorView, ViewUpdate } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import cstToRaw from "./down/cstToRaw";
import { Diagnostic } from "@codemirror/lint";
import { jquery, keys } from "utils/depUtils";
import { ensureSyntaxTree } from "@codemirror/language";
import { Tree } from "@lezer/common";
import {
  RelevantEvent,
  relevantEventTypes,
  eventSequenceChanges,
} from "./modify/modify";
import { MapIDPosition, applyChanges } from "./modify/mapIDPosition";
import getText from "./up/getText";

export default class Controller {
  inTextMode: boolean = false;
  view: EditorView | null = null;
  /**
   * Was the current/latest parsing cycle caused by a user edit?
   *
   * Start false, user edit sets lastUpdateWasByUser to true, then set to
   * false on the Calc.setState applying the user changes
   */
  lastUpdateWasByUser: boolean = false;
  /**
   * Will the next onEdit be due to an update from the graph automatically
   * changing the text, not a user?
   *
   * TODO: This should be replaced with the remote or userEvent annotations on
   * transactions (in case an actual user event gets combined with this one),
   * but I haven't figured out transaction annotations yet.
   */
  nextEditDueToGraph: boolean = true;
  dispatchListenerID: string | null = null;
  /** Dispatched events to handle once the syntax tree finishes */
  queuedEvents: RelevantEvent[] = [];
  parseCheckInterval: number | null = null;
  lintResolve: ((e: Diagnostic[]) => void) | null = null;
  /**
   * isParsing = false: idle state
   *    mapIDPosition + diagnostics are in sync with document
   * isParsing = true: parsing state
   *    text has been edited, mapIDPosition + diagnostics not yet updated
   */
  isParsing: boolean = false;
  mapIDPosition: MapIDPosition = {};
  diagnostics: Diagnostic[] = [];

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }

  mountEditor(container: HTMLDivElement) {
    this.lastUpdateWasByUser = false;
    this.nextEditDueToGraph = true;
    this.view = initView(this);
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = Calc.controller.dispatcher.register((event) => {
      if ((relevantEventTypes as readonly string[]).includes(event.type))
        this.onCalcEvent(event as RelevantEvent);
    });
  }

  /** Returns [hasError, string text] */
  getInitialText(): [boolean, string] {
    const [hasError, text, idMap] = getText();
    this.mapIDPosition = idMap;
    return [hasError, text];
  }

  unmountEditor(container: HTMLDivElement) {
    if (this.dispatchListenerID !== null) {
      Calc.controller.dispatcher.unregister(this.dispatchListenerID);
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    this.queuedEvents = [];
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

  doLint(): Promise<Diagnostic[]> {
    return new Promise((resolve) => {
      if (!this.isParsing) {
        resolve(this.diagnostics);
      } else {
        if (this.lintResolve !== null)
          throw "Programming Error: Second lint before the first resolved";
        this.lintResolve = resolve;
      }
    });
  }

  setParsing(parsing: boolean) {
    if (this.isParsing == parsing) return;
    this.isParsing = parsing;
    console.log("set parsing", parsing);
    if (parsing) {
      if (this.parseCheckInterval !== null)
        throw "Programming Error: start parsing with parseCheckInterval non-null";
      this.parseCheckInterval = window.setInterval(() => this.parseCheck(), 50);
    } else {
      if (this.parseCheckInterval === null)
        throw "Programming error: stop parsing with parseCheckInterval null";
      clearInterval(this.parseCheckInterval);
      this.parseCheckInterval = null;
    }
  }

  parseCheck() {
    if (!this.view) {
      this.setParsing(false);
      return;
    }
    const tree = ensureFullTree(this.view);
    if (tree !== null) {
      this.onFinishParsing(tree);
    }
  }

  /**
   * onCalcEvent: when we receive a new event dispatched via Calc (such as a
   * slider value change, or viewport move) which affects the text
   */
  onCalcEvent(event: RelevantEvent) {
    if (!this.view) return;
    this.queuedEvents.push(event);
    if (!this.isParsing) {
      const tree = ensureFullTree(this.view);
      if (tree === null) {
        this.setParsing(true);
      } else {
        this.processQueuedEvents(tree);
      }
    }
  }

  onEditorUpdate(update: ViewUpdate) {
    if (this.nextEditDueToGraph) {
      this.nextEditDueToGraph = false;
    } else if (update.docChanged) {
      // TODO: look into @codemirror/collab to treat dispatched events as a
      // collaborator
      // Pretty complicated: https://codemirror.net/6/examples/collab/
      this.onUserEdit();
    }
  }

  /**
   * onUserEdit: when the user edits text, so the current document text is out
   * of sync with the graph state, current ID map, and diagnostics
   */
  onUserEdit() {
    console.log("user edit");
    this.lastUpdateWasByUser = true;
    if (!this.isParsing) {
      this.setParsing(true);
    }
  }

  /**
   * onFinishParsing: when our ensureFullTree loop gives a non-null tree,
   * so we know the tree is in sync with the doc.
   */
  onFinishParsing(tree: Tree) {
    console.log("finish parsing");
    if (!this.view) return;
    this.setParsing(false);
    const [diagnostics, rawGraphState, mapID] = cstToRaw(
      tree,
      this.view.state.doc
    );
    this.diagnostics = diagnostics;
    if (this.lintResolve) {
      this.lintResolve(diagnostics);
      this.lintResolve = null;
    }
    this.mapIDPosition = mapID;
    const textChangedBecauseWorker = this.queuedEvents.length > 0;
    if (textChangedBecauseWorker) this.processQueuedEvents(tree);
    if (this.lastUpdateWasByUser) {
      console.log("set state from text", rawGraphState);
      // Prevent Desmos from blurring the currently active element via
      //   jquery(document.activeElement).trigger("blur")
      // Alternative method this.view.focus() after setState does not prevent
      //   the current autocomplete tooltip from disappearing
      const trigger = jquery.prototype.trigger;
      jquery.prototype.trigger = () => [];
      Calc.setState(rawGraphState, { allowUndo: true });
      jquery.prototype.trigger = trigger;
      this.lastUpdateWasByUser = false;
    } else if (!textChangedBecauseWorker) this.setParsing(false);
  }

  /**
   * Finally apply queued events, now that we definitely have a parse tree
   * available. Uses `this.mapIDPosition` to locate existing items by ID,
   * so `this.mapIDPosition` must be in sync with the current document
   */
  processQueuedEvents(tree: Tree) {
    if (!this.view) return;
    const changes = eventSequenceChanges(this, this.queuedEvents, tree);
    if (changes.length === 0) return;
    console.log("apply changes from queued events");
    const transaction = this.view.state.update({ changes });
    // TODO: figure out annotations on this transaction as mentioned in the
    // nextEditDueToGraph doc text
    this.nextEditDueToGraph = true;
    this.view.update([transaction]);
    applyChanges(this.mapIDPosition, transaction.changes);
    this.queuedEvents = [];
    this.setParsing(true);
  }
}

/**
 * Try to get a full parse tree for the current document given in `view`, doing
 * at most 20ms of work. If incomplete, return null.
 */
function ensureFullTree(view: EditorView) {
  const state = view.state;
  return ensureSyntaxTree(state, state.doc.length, 20);
}
