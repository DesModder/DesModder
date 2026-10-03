/**
 * Writes the fluid's measurements into the graph, when asked (opt-in, brief
 * §8.0), as ordinary Desmos variables the user can build on.
 *
 * For the n-th solid, counting the shown, compiled rows from the top:
 *
 *   C_{Dn}   its drag coefficient
 *   C_{Ln}   its lift coefficient
 *   S_{tn}   its Strouhal number
 *
 * A value that has not settled is written as 0/0, which Desmos shows as
 * undefined. Anything built on it then says so, rather than computing with a
 * start-up transient.
 *
 * The rules are Audio Lab's (`DesmosAudioAdapter.ts`):
 * - **Creating the set is one `setState`**: atomic, undoable, and in one
 *   folder.
 * - **Every update after that is a throttled `setExpressions`**, with
 *   unchanged values dropped, because a `setState` per update would
 *   serialise the user's whole graph several times a second.
 * - **Removal is by exact id.**
 * - **A name the graph already defines** is refused with a reason, not
 *   overwritten. Two definitions of one name would break the user's
 *   expression and ours both.
 */

import type { Calc } from "#globals";
import type { ExpressionState, ItemState } from "graph-state/state";
import type { BodyMeasurement } from "./FluidSession";
import { canonicalIdentifier } from "../../../field-rendering/identifiers";

const FOLDER_ID = "vector_tools_fluid_folder";
const PREFIX = "vector_tools_fluid_";
/** Four a second: measurements change slowly, and the graph is not a display. */
const WRITE_INTERVAL_MS = 250;

interface Variable {
  id: string;
  name: string;
  value: (m: BodyMeasurement) => number | undefined;
}

function variablesFor(index: number): Variable[] {
  const n = index + 1;
  const settled = (m: BodyMeasurement, v: number) =>
    m.settled && Number.isFinite(v) ? v : undefined;
  return [
    {
      id: `${PREFIX}cd_${n}`,
      name: `C_{D${n}}`,
      value: (m) => settled(m, m.drag),
    },
    {
      id: `${PREFIX}cl_${n}`,
      name: `C_{L${n}}`,
      value: (m) => settled(m, m.lift),
    },
    { id: `${PREFIX}st_${n}`, name: `S_{t${n}}`, value: (m) => m.strouhal },
  ];
}

/** Four significant figures: what the measurement can honestly claim. */
function valueLatex(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "0/0";
  return Number(value.toPrecision(4))
    .toString()
    .replace(/e\+?(-?\d+)/, "\\cdot10^{$1}");
}

export class FluidGraphWriter {
  private installed: Variable[] = [];
  private readonly written = new Map<string, string>();
  private lastWrite = 0;
  /** Why the variables could not be written, or "" if they were. */
  problem = "";

  constructor(private readonly calc: Calc) {}

  get isInstalled() {
    return this.installed.length > 0;
  }

  /**
   * Publishes the measurements, installing or reinstalling the set when the
   * number of solids changes. Called every frame; writes four times a second.
   */
  update(
    measurements: readonly BodyMeasurement[],
    definedNames: ReadonlySet<string>,
    now: number
  ) {
    if (now - this.lastWrite < WRITE_INTERVAL_MS) return;
    this.lastWrite = now;
    const wanted = measurements.flatMap((_, i) => variablesFor(i));
    if (wanted.length !== this.installed.length) {
      // Compared in canonical spelling, as the graph's scan stores names:
      // C_{D1} and C_D1 are one name to Desmos.
      const taken = wanted.find((v) =>
        definedNames.has(canonicalIdentifier(v.name))
      );
      if (taken) {
        this.problem = `The graph already defines ${taken.name}, so the measurements were not written into it.`;
        this.remove();
        return;
      }
      this.install(wanted, measurements);
      return;
    }
    const changes: { id: string; latex: string }[] = [];
    measurements.forEach((m, i) => {
      for (const variable of variablesFor(i)) {
        const latex = `${variable.name}=${valueLatex(variable.value(m))}`;
        if (this.written.get(variable.id) === latex) continue;
        this.written.set(variable.id, latex);
        changes.push({ id: variable.id, latex });
      }
    });
    if (changes.length > 0) this.calc.setExpressions(changes);
  }

  private install(
    variables: Variable[],
    measurements: readonly BodyMeasurement[]
  ) {
    const state = this.calc.getState();
    const others = state.expressions.list.filter(
      (item) => item.id !== FOLDER_ID && !item.id.startsWith(PREFIX)
    );
    this.written.clear();
    const items: ItemState[] = [];
    if (variables.length > 0) {
      items.push({
        type: "folder",
        id: FOLDER_ID,
        title: "Vector Tools — fluid measurements",
        collapsed: false,
      });
      measurements.forEach((m, i) => {
        for (const variable of variablesFor(i)) {
          const latex = `${variable.name}=${valueLatex(variable.value(m))}`;
          this.written.set(variable.id, latex);
          items.push({
            type: "expression",
            id: variable.id,
            folderId: FOLDER_ID,
            latex,
            color: "#2d70b3",
          } satisfies ExpressionState);
        }
      });
    }
    state.expressions.list = [...others, ...items];
    this.calc.setState(state, { allowUndo: true });
    this.installed = variables;
    this.problem = "";
  }

  /** Removes exactly what this created, if anything. */
  remove() {
    if (!this.isInstalled) return;
    const owned = new Set([FOLDER_ID, ...this.installed.map((v) => v.id)]);
    const state = this.calc.getState();
    state.expressions.list = state.expressions.list.filter(
      (item) => !owned.has(item.id)
    );
    this.calc.setState(state, { allowUndo: true });
    this.installed = [];
    this.written.clear();
  }

  /** The ids this writes under, so the solid list can ignore its own rows. */
  static readonly prefix = PREFIX;
}
