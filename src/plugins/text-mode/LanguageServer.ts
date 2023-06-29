/**
 * This isn't really a language server anymore, but it's a reasonable analogy.
 * The functions in this file manage the interface between codemirror and
 * the Text Mode compiler.
 */
import { DispatchedEvent } from "../../globals/Calc";
import { Program, Statement } from "./down/TextAST";
import textToRaw from "./down/textToRaw";
import { eventSequenceChanges } from "./modify";
import { Diagnostic } from "@codemirror/lint";
import { StateField, Text, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { Calc } from "globals/window";
import { jquery } from "utils/depUtils";

export interface ProgramAnalysis {
  program: Program;
  diagnostics: readonly Diagnostic[];
  mapIDstmt: Record<string, Statement>;
}

/**
 * onCalcEvent: when we receive a new event dispatched via Calc (such as a
 * slider value change, or viewport move) which affects the text
 */
export function onCalcEvent(view: EditorView, event: DispatchedEvent) {
  // should this be a state effect?
  const analysis = view.state.field(analysisStateField);
  if (event.type === "set-selected-id") {
    if (event.dsmFromTextModeSelection) return;
    const stmt = analysis.mapIDstmt[event.id];
    const transaction = view.state.update({
      scrollIntoView: true,
      selection: { anchor: stmt.pos.from },
    });
    view.dispatch(transaction);
    return;
  }
  const changes = eventSequenceChanges(view, event, analysis);
  // on-evaluator-changes could mean some item model changes, which affects
  // style circles. Keep the transaction to update style circles.
  if (changes.length === 0 && event.type !== "on-evaluator-changes") return;
  const transaction = view.state.update({
    changes,
    annotations: [Transaction.remote.of(true)],
  });
  view.dispatch(transaction);
}

export function parseAndReturnAnalysis(doc: Text, nextEditDueToGraph: boolean) {
  const s = doc.sliceString(0);
  const [analysis, rawGraphState] = textToRaw(s);
  if (!nextEditDueToGraph && rawGraphState !== null)
    setCalcState(rawGraphState);
  return analysis;
}

/** This field is stored on the state and gets updated every time the document
 * is edited. So the analysis always stays perfectly in sync. This may not be
 * the best for performance, but it's huge for simplicity and correctness. */
export const analysisStateField = StateField.define<ProgramAnalysis>({
  create: (state) => parseAndReturnAnalysis(state.doc, false),
  update: (value, transaction) => {
    if (transaction.docChanged) {
      // This is where you would handle incremental updates in the input.
      return parseAndReturnAnalysis(
        transaction.newDoc,
        transaction.annotation(Transaction.remote) ?? false
      );
    } else return value;
  },
});

function setCalcState(state: GraphState) {
  // Prevent Desmos from blurring the currently active element via
  //   jquery(document.activeElement).trigger("blur")
  // Alternative method this.view.focus() after setState does not prevent
  //   the current autocomplete tooltip from disappearing
  const trigger = jquery.prototype.trigger;
  jquery.prototype.trigger = () => [];
  Calc.setState(state, { allowUndo: true, fromTextMode: true } as any);
  jquery.prototype.trigger = trigger;
}

export function doLint(view: EditorView) {
  return view.state.field(analysisStateField).diagnostics;
}
