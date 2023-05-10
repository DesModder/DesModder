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
import textToRaw from "./down/textToRaw";
import { RelevantEvent, eventSequenceChanges } from "./modify";
import { Diagnostic } from "@codemirror/lint";
import { Transaction } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";

export interface ProgramAnalysis {
  ast: Program;
  diagnostics: Diagnostic[];
  mapIDstmt: Record<string, Statement | undefined>;
}

export default class LanguageServer {
  analysis!: ProgramAnalysis;

  constructor(
    private readonly view: EditorView,
    private readonly setCalcState: (state: GraphState) => void
  ) {
    this.parse(false);
  }

  async doLint(): Promise<Diagnostic[]> {
    return await new Promise((resolve) => {
      resolve(this.analysis.diagnostics);
    });
  }

  parse(nextEditDueToGraph: boolean) {
    // Parse and set tree
    const s = this.view.state.doc.sliceString(0);
    const [analysis, rawGraphState] = textToRaw(s);
    this.analysis = analysis;
    if (!nextEditDueToGraph && rawGraphState !== null)
      this.setCalcState(rawGraphState);
  }

  onEditorUpdate(update: ViewUpdate) {
    if (update.docChanged)
      this.parse(
        update.transactions.every((x) => x.annotation(Transaction.remote))
      );
  }

  /**
   * onCalcEvent: when we receive a new event dispatched via Calc (such as a
   * slider value change, or viewport move) which affects the text
   */
  onCalcEvent(event: RelevantEvent) {
    const changes = eventSequenceChanges(this.view, [event], this.analysis);
    if (changes.length === 0) return;
    const transaction = this.view.state.update({
      changes,
      annotations: [Transaction.remote.of(true)],
    });
    this.view.dispatch(transaction);
  }
}
