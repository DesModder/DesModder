import { EditorView } from "@codemirror/view";
import { Calc } from "globals/window";
import { initView } from "./view/editor";
import applyCST from "./down/applyCST";
import { Diagnostic } from "@codemirror/lint";
import { keys } from "utils/depUtils";
import { ensureSyntaxTree } from "@codemirror/language";
import { DispatchedEvent } from "globals/Calc";
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
   * Is the initial doc being applying from initView()?
   * or was the most recent modification of the text based on a state change
   * from the graph?
   */
  lastUpdateWasByUser: boolean = false;
  applyingUpdateFromText: boolean = false;
  lastDiagnostics: Diagnostic[] = [];
  dispatchListenerID: string | null = null;
  /** Dispatched events to handle once the syntax tree finishes */
  queuedEvents: RelevantEvent[] = [];
  currentlyLooping: boolean = false;
  mapIDPosition: MapIDPosition = {};

  toggleTextMode() {
    this.inTextMode = !this.inTextMode;
    Calc.controller.updateViews();
  }

  mountEditor(container: HTMLDivElement) {
    this.lastUpdateWasByUser = false;
    this.view = initView(this);
    container.appendChild(this.view.dom);
    this.preventPropagation(container);
    this.dispatchListenerID = Calc.controller.dispatcher.register(
      this.pushEvent.bind(this)
    );
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

  pushEvent(event: DispatchedEvent) {
    if (!this.view) return;
    if (!(relevantEventTypes as readonly string[]).includes(event.type)) return;
    this.queuedEvents.push(event as RelevantEvent);
    if (this.currentlyLooping) {
      // Another loop is currently checking for the syntax tree to be ready
      return;
    }
    const tryProcessQueuedEvents = () => {
      if (!this.view) {
        this.currentlyLooping = false;
        return;
      }
      const state = this.view.state;
      const tree = ensureSyntaxTree(state, state.doc.length, 25);
      if (tree !== null) {
        this.processQueuedEvents(tree);
        this.currentlyLooping = false;
      } else {
        // try again later for a valid syntax tree
        setTimeout(tryProcessQueuedEvents, 50);
      }
    };
    tryProcessQueuedEvents();
  }

  processQueuedEvents(tree: Tree) {
    if (!this.view) return;
    this.lastUpdateWasByUser = false;
    const transaction = this.view.state.update({
      changes: eventSequenceChanges(this, this.queuedEvents, tree),
    });
    this.view.update([transaction]);
    applyChanges(this.mapIDPosition, transaction.changes);
    this.queuedEvents = [];
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
  doLint(): Promise<Diagnostic[]> {
    return new Promise((resolve) => {
      if (!this.lastUpdateWasByUser) {
        // TODO: also set this.lastUpdateWasByUser = true if the user edits
        // the text while a non-user update was waiting to be acted upon
        this.lastUpdateWasByUser = true;
        // Assume computer actions (changing viewport bounds for example)
        // do not affect any diagnostics
        resolve(this.lastDiagnostics);
      } else {
        const stLoop = setInterval(() => {
          // don't use the `view` function parameter to doLint because we want
          // to stop the loop if the view got destroyed
          if (this.view === null) {
            clearInterval(stLoop);
            return;
          }
          const state = this.view.state;
          const syntaxTree = ensureSyntaxTree(state, state.doc.length, 50);
          if (syntaxTree) {
            clearInterval(stLoop);
            console.log("Applying update from text");
            this.applyingUpdateFromText = true;
            const [diagnostics, mapID] = applyCST(syntaxTree, state.sliceDoc());
            this.lastDiagnostics = diagnostics;
            this.mapIDPosition = mapID;
            this.view.focus();
            this.applyingUpdateFromText = false;
            resolve(diagnostics);
          }
        }, 100);
      }
    });
  }
}
