/**
 * Language server, handling the AST and program analysis stuff for text mode.
 *
 * All state regarding parsing and program analysis should be managed through
 * the LanguageServer.
 *
 * The LanguageServer should not mutate or read the Calc state or other
 * unrelated state.
 *
 * This can maybe be moved to a worker at some point? But codemirror isn't in a
 * worker, so not sure.
 */

import { Diagnostic } from "@codemirror/lint";
import {
  RelevantEvent,
  relevantEventTypes,
  eventSequenceChanges,
} from "./modify/modify";
import { MapIDPosition, applyChanges } from "./modify/mapIDPosition";
import { jquery, keys } from "utils/depUtils";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Tree } from "@lezer/common";
import cstToRaw from "./down/cstToRaw";
import { ensureSyntaxTree } from "@codemirror/language";
import { Calc } from "globals/window";

export default class LanguageServer {
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
  diagnostics: Diagnostic[] = [];
  /**
   * Will the next onEdit be due to an update from the graph automatically
   * changing the text, not a user?
   *
   * TODO: This should be replaced with the remote or userEvent annotations on
   * transactions (in case an actual user event gets combined with this one),
   * but I haven't figured out transaction annotations yet.
   */
  nextEditDueToGraph: boolean = true;
  /**
   * Was the current/latest parsing cycle caused by a user edit?
   *
   * Start false, user edit sets lastUpdateWasByUser to true, then set to
   * false on the Calc.setState applying the user changes
   */
  lastUpdateWasByUser: boolean = false;

  constructor(private view: EditorView, public mapIDPosition: MapIDPosition) {}

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

  destroy() {
    if (this.parseCheckInterval !== null)
      clearInterval(this.parseCheckInterval);
    this.queuedEvents = [];
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
