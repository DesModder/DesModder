/**
 * This isn't really a language server anymore, but it's a reasonable analogy.
 * The functions in this file manage the interface between codemirror and
 * the Text Mode compiler.
 */
import { getTextModeConfig } from ".";
import { ProgramAnalysis, textToRaw } from "../../../text-mode-core";
import { DispatchedEvent } from "../../globals/Calc";
import { eventSequenceChanges } from "./modify";
import {
  StateField,
  StateEffect,
  Transaction,
  EditorState,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { Calc } from "#globals";

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
  let { changes, effects } = eventSequenceChanges(view, event, analysis);
  effects ??= [];
  if (
    changes.length === 0 &&
    effects.length === 0 &&
    // on-evaluator-changes could mean some item model changes, which affects
    // style circles. Keep the transaction to update style circles.
    event.type !== "on-evaluator-changes"
  )
    return;
  const transaction = view.state.update({
    changes,
    effects,
    annotations: [Transaction.remote.of(true)],
  });
  view.dispatch(transaction);
}

export function parseAndReturnAnalysis(
  state: EditorState,
  nextEditDueToGraph: boolean,
  rawIDs: RawIDRange[]
) {
  const cfg = getTextModeConfig();
  const s = state.doc.sliceString(0);
  const [analysis, rawGraphState] = textToRaw(cfg, s, { rawIDs });
  if (!nextEditDueToGraph && rawGraphState !== null)
    setCalcState(rawGraphState);
  return analysis;
}

/** This field is stored on the state and gets updated every time the document
 * is edited. So the analysis always stays perfectly in sync. This may not be
 * the best for performance, but it's huge for simplicity and correctness. */
export const analysisStateField = StateField.define<ProgramAnalysis>({
  create: (state) => parseAndReturnAnalysis(state, false, []),
  update: (value, transaction) => {
    function mapID({ from, to, id }: RawIDRange) {
      return {
        from: transaction.changes.mapPos(from, -1),
        to: transaction.changes.mapPos(to, 1),
        id,
      };
    }
    if (transaction.docChanged) {
      // This is where you would handle incremental updates in the input.
      const oldIDs = Object.values(value.mapIDstmt)
        .map((s) => {
          const to =
            s.type === "Folder" || s.type === "Table" ? s.afterOpen : s.pos.to;
          return { from: s.pos.from, to, id: s.id };
        })
        .map(mapID);
      const rawIDs = transaction.effects
        .filter((e): e is ReturnType<(typeof addRawID)["of"]> => e.is(addRawID))
        .map(({ value }) => mapID(value));
      return parseAndReturnAnalysis(
        transaction.state,
        transaction.annotation(Transaction.remote) ?? false,
        rawIDs.concat(oldIDs)
      );
    } else return value;
  },
});

interface RawIDRange {
  from: number;
  to: number;
  id: string;
}

/** addRawID expects `{from,to}` positions from *before* any text
 * changes in the same transaction. */
export const addRawID = StateEffect.define<RawIDRange>({
  map: ({ from, to, id }, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to),
    id,
  }),
});

function setCalcState(state: GraphState) {
  // Prevent Desmos from blurring the currently active element.
  // Alternative method this.view.focus() after setState does not prevent
  //   the current autocomplete tooltip from disappearing
  const ae = document.activeElement as HTMLElement | undefined;
  const oldBlur = ae?.blur;
  if (ae) ae.blur = () => {};
  // Just marking state as any for now. Eventually we'll want to pull
  // @desmodder/graph-state into this repository (like @desmodder/text-mode-core),
  // to avoid needing to deal with npm back-and-forth.
  (state.graph as any).product = Calc.controller.graphSettings.config.product;
  Calc.setState(state, { allowUndo: true, fromTextMode: true } as any);
  if (ae) ae.blur = oldBlur!;
}

export function doLint(view: EditorView) {
  return view.state.field(analysisStateField).diagnostics;
}
