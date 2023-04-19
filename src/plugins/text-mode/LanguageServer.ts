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
import { EditorView, ViewUpdate } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";

export interface ProgramAnalysis {
  ast: Program;
  diagnostics: Diagnostic[];
  mapIDstmt: Record<string, Statement | undefined>;
}

export default class LanguageServer {
  analysis!: ProgramAnalysis;
  /**
   * Will the next onEdit be due to an update from the graph automatically
   * changing the text, not a user?
   *
   * TODO: This should be replaced with the remote or userEvent annotations on
   * transactions (in case an actual user event gets combined with this one),
   * but I haven't figured out transaction annotations yet.
   */
  nextEditDueToGraph: boolean = true;

  constructor(
    private readonly view: EditorView,
    private readonly setCalcState: (state: GraphState) => void
  ) {
    this.parse();
  }

  async doLint(): Promise<Diagnostic[]> {
    return await new Promise((resolve) => {
      resolve(this.analysis.diagnostics);
    });
  }

  parse() {
    // Parse and set tree
    const s = this.view.state.doc.sliceString(0);
    const [analysis, rawGraphState] = textToRaw(s);
    this.analysis = analysis;
    if (!this.nextEditDueToGraph && rawGraphState !== null)
      this.setCalcState(rawGraphState);
    this.nextEditDueToGraph = false;
  }

  onEditorUpdate(update: ViewUpdate) {
    if (update.docChanged) this.parse();
  }

  /**
   * onCalcEvent: when we receive a new event dispatched via Calc (such as a
   * slider value change, or viewport move) which affects the text
   */
  onCalcEvent(event: RelevantEvent) {
    const changes = eventSequenceChanges(this.view, [event], this.analysis);
    if (changes.length === 0) return;
    const transaction = this.view.state.update({ changes });
    // TODO: figure out annotations on this transaction as mentioned in the
    // nextEditDueToGraph doc text
    this.nextEditDueToGraph = true;
    this.view.update([transaction]);
  }
}
