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
  RangeSet,
  RangeValue,
  EditorState,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GraphState } from "@desmodder/graph-state";
import { Calc } from "globals/window";

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

function rawIDRangesFromState(state: EditorState) {
  const cursor = state.field(rawIDStateField).iter();
  const rawIDRanges = [];
  while (cursor.value !== null) {
    const { value, from, to } = cursor;
    rawIDRanges.push({ id: value.id, from, to });
    cursor.next();
  }
  return rawIDRanges;
}

export function parseAndReturnAnalysis(
  state: EditorState,
  nextEditDueToGraph: boolean
) {
  const cfg = getTextModeConfig();
  const s = state.doc.sliceString(0);
  const [analysis, rawGraphState] = textToRaw(cfg, s, {
    rawIDs: rawIDRangesFromState(state),
  });
  if (!nextEditDueToGraph && rawGraphState !== null)
    setCalcState(rawGraphState);
  return analysis;
}

/** This field is stored on the state and gets updated every time the document
 * is edited. So the analysis always stays perfectly in sync. This may not be
 * the best for performance, but it's huge for simplicity and correctness. */
export const analysisStateField = StateField.define<ProgramAnalysis>({
  create: (state) => parseAndReturnAnalysis(state, false),
  update: (value, transaction) => {
    if (transaction.docChanged) {
      // This is where you would handle incremental updates in the input.
      return parseAndReturnAnalysis(
        transaction.state,
        transaction.annotation(Transaction.remote) ?? false
      );
    } else return value;
  },
});

class RawID extends RangeValue {
  startSide = -1;
  endSide = 1;
  // I don't understand point
  point = true;

  constructor(public id: string) {
    super();
  }

  eq(other: RawID) {
    return other.id === this.id;
  }
}

/** addRawID expects `{from,to}` positions from *before* any text
 * changes in the same transaction. */
export const addRawID = StateEffect.define<{
  from: number;
  to: number;
  id: string;
}>({
  map: ({ from, to, id }, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to),
    id,
  }),
});

/** Keep track of the IDs as expected by Desmos, so it can insert a
 * statement in the middle without breaking the ids of later things. */
export const rawIDStateField = StateField.define<RangeSet<RawID>>({
  create() {
    return RangeSet.of([]);
  },
  update(rawIDs, tr) {
    for (const e of tr.effects)
      if (e.is(addRawID)) {
        rawIDs = rawIDs.update({
          add: [new RawID(e.value.id).range(e.value.from, e.value.to)],
        });
      }
    rawIDs = rawIDs.map(tr.changes);
    return rawIDs;
  },
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
