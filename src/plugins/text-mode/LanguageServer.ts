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
import { Program, Statement } from "./down/TextAST";
import cstToRaw from "./down/cstToRaw";
import { RelevantEvent, eventSequenceChanges } from "./modify";
import { ensureSyntaxTree } from "@codemirror/language";
import { Diagnostic } from "@codemirror/lint";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { Tree } from "@lezer/common";

export interface ProgramAnalysis {
  ast: Program;
  diagnostics: Diagnostic[];
  mapIDstmt: Record<string, Statement | undefined>;
}

export default class LanguageServer {
  /** Dispatched events to handle once the syntax tree finishes */
  queuedEvents: RelevantEvent[] = [];
  parseCheckInterval: number | null = null;
  lintResolve: ((e: Diagnostic[]) => void) | null = null;
  /**
   * isParsing = false: idle state
   *    analysis is in sync with document
   * isParsing = true: parsing state
   *    text has been edited, analysis is out of date
   */
  isParsing: boolean = false;
  analysis: ProgramAnalysis | null = null;
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

  constructor(
    private readonly view: EditorView,
    private readonly setCalcState: (state: GraphState) => void
  ) {
    this.setParsing(true);
  }

  async doLint(): Promise<Diagnostic[]> {
    return await new Promise((resolve) => {
      if (!this.isParsing) {
        resolve(this.analysis!.diagnostics);
      } else {
        if (this.lintResolve !== null)
          throw Error(
            "Programming Error: Second lint before the first resolved"
          );
        this.lintResolve = resolve;
      }
    });
  }

  setParsing(parsing: boolean) {
    if (this.isParsing === parsing) return;
    this.isParsing = parsing;
    if (parsing) {
      if (this.parseCheckInterval !== null)
        throw Error(
          "Programming Error: start parsing with parseCheckInterval non-null"
        );
      this.parseCheckInterval = window.setInterval(() => this.parseCheck(), 50);
    } else {
      if (this.parseCheckInterval === null)
        throw Error(
          "Programming error: stop parsing with parseCheckInterval null"
        );
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
      this.processQueuedEvents();
    }
  }

  /**
   * onUserEdit: when the user edits text, so the current document text is out
   * of sync with the graph state, current ID map, and diagnostics
   */
  onUserEdit() {
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
    if (!this.view) return;
    this.setParsing(false);
    const [analysis, rawGraphState] = cstToRaw(tree, this.view.state.doc);
    this.analysis = analysis;
    if (this.lintResolve) {
      this.lintResolve(analysis.diagnostics);
      this.lintResolve = null;
    }
    const textChangedBecauseWorker = this.queuedEvents.length > 0;
    if (textChangedBecauseWorker) this.processQueuedEvents();
    if (this.lastUpdateWasByUser && rawGraphState !== null) {
      this.setCalcState(rawGraphState);
      this.lastUpdateWasByUser = false;
    } else if (!textChangedBecauseWorker) this.setParsing(false);
  }

  /**
   * Finally apply queued events, now that we definitely have a parse tree
   * available. Uses `this.mapIDPosition` to locate existing items by ID,
   * so `this.mapIDPosition` must be in sync with the current document
   */
  processQueuedEvents() {
    const changes = eventSequenceChanges(
      this.view,
      this.queuedEvents,
      this.analysis!
    );
    if (changes.length === 0) return;
    const transaction = this.view.state.update({ changes });
    // TODO: figure out annotations on this transaction as mentioned in the
    // nextEditDueToGraph doc text
    this.nextEditDueToGraph = true;
    this.view.update([transaction]);
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
