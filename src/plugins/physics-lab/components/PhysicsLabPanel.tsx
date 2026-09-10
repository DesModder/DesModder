/**
 * The Physics Lab panel.
 *
 * Written the way Vector Tools' panel is, because the three DCGView behaviours
 * that shape it are not preferences — each one silently broke a control there
 * before it was accounted for:
 *
 * - Only props passed as **functions** are re-read. A bare value is wrapped in
 *   `DCGView.const` and frozen at first render, so every control takes getters.
 * - Props are written as **attributes**, and `disabled="false"` is still a
 *   disabled input in HTML. `disabled` is never a prop; the property is
 *   assigned in `onUpdate`.
 * - Inputs are re-synced only while they do **not** hold focus, so a render
 *   triggered mid-edit cannot fight the user's typing.
 *
 * There are no `<select>` elements, for the same reason: a native dropdown in a
 * scrolling popover is awkward to hit, and DCGView cannot drive its selection
 * through props anyway. Option lists are rows of one-click chips.
 */
import PhysicsLab from "..";
import { Component, jsx } from "#DCGView";
import { mathquillFocusHelper } from "#globals";
import {
  Button,
  If,
  InlineMathInputViewGeneral,
  SegmentedControl,
  StaticMathQuillView,
  SwitchUnion,
} from "#components";
import { format } from "#i18n";
import {
  PANEL_TABS,
  SLOPE_COUNT_MAXIMUM,
  SLOPE_COUNT_MINIMUM,
  type PhysicsLabConfig,
} from "../model";
import type { VectorColorMode } from "../../../field-rendering/types";
import {
  PALETTES,
  PALETTE_IDS,
  paletteCSSGradient,
  type PaletteID,
} from "../../../field-rendering/palettes";
import type { ExactReading } from "../PhysicsLabSession";
import "./PhysicsLabPanel.less";

interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * The colour modes a slope field can actually use.
 *
 * A deliberate subset of what the renderer implements. `x-component` is the
 * constant 1 at every mark in a slope field — it would colour the whole field
 * flat and offer a control that does nothing. Magnitude here is sqrt(1 + f²),
 * which is steepness, so it is named that rather than named after the shader.
 */
const COLOR_MODES: readonly Choice<VectorColorMode>[] = [
  { value: "fixed", label: "One colour" },
  { value: "magnitude", label: "Steepness" },
  { value: "direction", label: "Direction" },
];

type ConfigGetter = () => PhysicsLabConfig;

export class PhysicsLabPanel extends Component<{
  physicsLab: () => PhysicsLab;
}> {
  template() {
    const physicsLab = this.props.physicsLab();
    const config: ConfigGetter = () => physicsLab.session.getConfig();

    return (
      <div
        class="dcg-popover-interior dsm-physics-lab-menu"
        didMount={(element: HTMLElement) =>
          physicsLab.attachPanelElement(element)
        }
        willUnmount={() => physicsLab.detachPanelElement()}
      >
        <div class="dcg-popover-title">{format("physics-lab-name")}</div>
        <div class="dsm-physics-lab-tabs">
          <SegmentedControl
            ariaGroupLabel="Physics Lab section"
            names={() => PANEL_TABS.map((tab) => tab.label)}
            selectedIndex={() =>
              PANEL_TABS.findIndex((tab) => tab.id === config().panel.tab)
            }
            setSelectedIndex={(index: number) =>
              physicsLab.session.setPanelTab(PANEL_TABS[index].id)
            }
          />
        </div>

        <div class="dsm-physics-lab-body">
          {SwitchUnion(() => config().panel.tab, {
            slope: () => slopeTab(physicsLab, config),
            exact: () => exactTab(physicsLab, config),
          })}
        </div>
      </div>
    );
  }
}

// ---- tabs ----------------------------------------------------------------

function slopeTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  return (
    <div>
      <section class="dsm-physics-lab-section">
        <label class="dsm-physics-lab-label">dy/dx =</label>
        <InlineMathInputViewGeneral
          containerClass={() => ({ "dsm-physics-lab-math-input": true })}
          placeholder="x-y"
          ariaLabel="f of x and y"
          latex={() => config().slope.fLatex}
          handleLatexChanged={(latex: string) =>
            session().updateConfig((c) => {
              c.slope.fLatex = latex;
            })
          }
          hasError={() =>
            session().validation.issues.some((issue) => issue.field === "f")
          }
          manageFocus={mathquillFocusHelper({
            controller: physicsLab.cc,
            location: {
              type: "dsm-focus",
              plugin: "physics-lab",
              kind: "slope-f",
            },
          })}
          controller={physicsLab.cc}
          readonly={false}
        />
        <div class="dsm-physics-lab-hint">
          Each mark is the tangent to the solution curve through its own point.
          They never touch, because two marks that met would draw a curve that
          solves nothing.
        </div>
        {solutionReadout(physicsLab)}
      </section>

      <section class="dsm-physics-lab-section">
        <div class="dsm-physics-lab-section-head">
          <h3>Sampling domain</h3>
          <Button
            color="light-gray"
            class="dsm-physics-lab-match-viewport"
            onTap={() => matchViewport(physicsLab)}
          >
            Match viewport
          </Button>
        </div>
        {axisControls(physicsLab, config, "x")}
        {axisControls(physicsLab, config, "y")}
        {checkboxControl(
          "Thin a grid too dense to read",
          () => config().slope.densityLimit,
          (checked) =>
            session().updateConfig((c) => {
              c.slope.densityLimit = checked;
            })
        )}
      </section>

      <section class="dsm-physics-lab-section">
        <h3>Marks</h3>
        {numberControl(
          "dsm-physics-lab-mark-length",
          "Length (of the spacing)",
          () => config().slope.markLength,
          (value) =>
            session().updateConfig((c) => {
              c.slope.markLength = value;
            })
        )}
        {numberControl(
          "dsm-physics-lab-line-width",
          "Thickness (px)",
          () => config().slope.lineWidth,
          (value) =>
            session().updateConfig((c) => {
              c.slope.lineWidth = value;
            })
        )}
        {chipGroup(
          "Colour by",
          () => config().slope.colorMode,
          COLOR_MODES,
          (value) =>
            session().updateConfig((c) => {
              c.slope.colorMode = value;
            }),
          "dsm-physics-lab-color-mode"
        )}
        {/* A ramp is only meaningful where something runs along it; one flat
            colour has nothing to spread along one. */}
        <If predicate={() => config().slope.colorMode !== "fixed"}>
          {() => paletteChooser(physicsLab, config)}
        </If>
        <If predicate={() => config().slope.colorMode === "fixed"}>
          {() => colorSwatch(physicsLab, config)}
        </If>
      </section>

      <div class="dsm-physics-lab-footer">
        <div class="dsm-physics-lab-status">{() => session().status}</div>
        <div class="dsm-physics-lab-actions">
          <Button
            color="blue"
            class="dsm-physics-lab-draw"
            onTap={() => session().toggleSlopeField()}
          >
            {() => (session().isDrawing ? "Stop drawing" : "Draw slope field")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The solved equation, shown under the equation itself.
 *
 * Deliberately not on a tab of its own. The solution and the slope field are
 * two views of one object — the marks are the tangents of the curves the
 * solution describes — and putting them on separate tabs would hide the single
 * most useful thing here, which is watching a solution curve run tangent to
 * every mark it crosses while the slider for C drags it through the family.
 *
 * Nothing is shown when there is no solution to show. Most equations somebody
 * types are half-typed, and an error under a field being edited reads as the
 * tool complaining rather than as the tool waiting.
 */
function solutionReadout(physicsLab: PhysicsLab) {
  const result = () => physicsLab.session.solution;
  const solved = () => {
    const value = result();
    return value?.ok === true ? value.solution : undefined;
  };
  const failure = () => {
    const value = result();
    return value?.ok === false && value.error !== "" ? value.error : "";
  };
  return (
    <div>
      <If predicate={() => solved() !== undefined}>
        {() => (
          <div class="dsm-physics-lab-solution">
            {/* Rendered as maths rather than shown as its own source. Desmos
                already draws LaTeX better than anything this plugin would
                ship, and an answer printed as `\frac{x}{3}` asks the reader to
                parse the notation before they can read the result. The string
                is still carried in a data attribute, so the integration test
                can assert on exactly what the button will insert. */}
            <div
              class="dsm-physics-lab-math"
              data-physics-lab="solution"
              data-latex={() => solved()?.latex ?? ""}
            >
              <StaticMathQuillView latex={() => solved()?.latex ?? ""} />
            </div>
            <div class="dsm-physics-lab-inline">
              <Button
                color="blue"
                class="dsm-physics-lab-add-solution"
                onTap={() => physicsLab.session.insertSolution()}
              >
                Add solution to graph
              </Button>
              <span class="dsm-physics-lab-method">
                {() => solved()?.method ?? ""}
              </span>
            </div>
            {/* An implicit answer is a complete solution and is not a curve
                Desmos can plot as `y = …`; a reader has to know which they
                have before they try. */}
            <If predicate={() => solved()?.explicit === false}>
              {() => (
                <div class="dsm-physics-lab-hint">
                  This is a relation between x and y rather than y in terms of
                  x. Desmos will still draw it.
                </div>
              )}
            </If>
          </div>
        )}
      </If>
      <If predicate={() => failure() !== ""}>
        {() => <div class="dsm-physics-lab-hint">{() => failure()}</div>}
      </If>
    </div>
  );
}

function exactTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const reading = (): ExactReading | undefined =>
    session().exactValue(config().exact.latex);
  /**
   * A constant whose exact form is `7` is one Desmos already showed as 7.
   * Saying it again teaches nothing and makes the readout look broken on every
   * expression it has nothing to add to, so the whole block is hidden instead.
   */
  const hasExact = () => {
    const value = reading();
    return value !== undefined && !value.trivial;
  };
  return (
    <div>
      <section class="dsm-physics-lab-section">
        <label class="dsm-physics-lab-label">Exact value</label>
        <div class="dsm-physics-lab-hint">
          Desmos answers every constant with a decimal. This is the form it is
          written in — and nothing at all when there is no exact form to give.
        </div>
        <InlineMathInputViewGeneral
          containerClass={() => ({ "dsm-physics-lab-math-input": true })}
          placeholder="\sqrt{2}^{3}"
          ariaLabel="A constant expression"
          latex={() => config().exact.latex}
          handleLatexChanged={(latex: string) =>
            session().updateConfig((c) => {
              c.exact.latex = latex;
            })
          }
          hasError={() => false}
          manageFocus={mathquillFocusHelper({
            controller: physicsLab.cc,
            location: {
              type: "dsm-focus",
              plugin: "physics-lab",
              kind: "exact",
            },
          })}
          controller={physicsLab.cc}
          readonly={false}
        />
        <If predicate={hasExact}>
          {() => (
            <div class="dsm-physics-lab-exact-result">
              <div
                class="dsm-physics-lab-math"
                data-physics-lab="exact-output"
                data-latex={() => reading()?.latex ?? ""}
              >
                <StaticMathQuillView latex={() => reading()?.latex ?? ""} />
              </div>
              <div class="dsm-physics-lab-inline">
                <Button
                  color="blue"
                  class="dsm-physics-lab-insert"
                  onTap={() => insertExact(physicsLab, reading()?.latex)}
                >
                  Add to graph
                </Button>
                <span class="dsm-physics-lab-decimal">
                  {() => `≈ ${(reading()?.value ?? 0).toPrecision(12)}`}
                </span>
              </div>
            </div>
          )}
        </If>
      </section>
    </div>
  );
}

/**
 * Puts the exact form into the graph, where Desmos renders it as maths.
 *
 * There is no second maths renderer here on purpose: Desmos already draws LaTeX
 * better than anything this plugin would ship, and an expression in the list is
 * also the form that survives without the extension.
 */
function insertExact(physicsLab: PhysicsLab, latex: string | undefined) {
  if (latex === undefined) return;
  physicsLab.calc.setExpression({ latex });
}

function matchViewport(physicsLab: PhysicsLab) {
  const bounds = physicsLab.calc.graphpaperBounds.mathCoordinates;
  physicsLab.session.updateConfig((config) => {
    config.slope.domain.x = {
      min: round(bounds.left),
      max: round(bounds.right),
    };
    config.slope.domain.y = {
      min: round(bounds.bottom),
      max: round(bounds.top),
    };
  });
}

/** A pan leaves noise digits on the bounds, and the number fields show them all. */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

// ---- controls ------------------------------------------------------------

function axisControls(
  physicsLab: PhysicsLab,
  config: ConfigGetter,
  axis: "x" | "y"
) {
  const session = () => physicsLab.session;
  const count = axis === "x" ? "columns" : "rows";
  return (
    <div class="dsm-physics-lab-axis">
      {numberControl(
        `dsm-physics-lab-${axis}-minimum`,
        `${axis} min`,
        () => config().slope.domain[axis].min,
        (value) =>
          session().updateConfig((c) => {
            c.slope.domain[axis].min = value;
          })
      )}
      {numberControl(
        `dsm-physics-lab-${axis}-maximum`,
        `${axis} max`,
        () => config().slope.domain[axis].max,
        (value) =>
          session().updateConfig((c) => {
            c.slope.domain[axis].max = value;
          })
      )}
      {numberControl(
        `dsm-physics-lab-${axis}-count`,
        "marks",
        () => config().slope[count],
        (value) =>
          session().updateConfig((c) => {
            c.slope[count] = Math.round(
              Math.min(
                SLOPE_COUNT_MAXIMUM,
                Math.max(SLOPE_COUNT_MINIMUM, value)
              )
            );
          })
      )}
    </div>
  );
}

function chipGroup<T extends string>(
  label: string,
  value: () => T,
  choices: readonly Choice<T>[],
  onChange: (value: T) => void,
  id?: string
) {
  return (
    <div class="dsm-physics-lab-chips" id={id} role="group" aria-label={label}>
      <div class="dsm-physics-lab-label">{label}</div>
      <div class="dsm-physics-lab-chip-row">
        {choices.map((choice) => (
          <span
            role="button"
            tabIndex={0}
            data-value={choice.value}
            class={() => ({
              "dsm-physics-lab-chip": true,
              "dsm-physics-lab-chip-selected": value() === choice.value,
            })}
            aria-pressed={() => (value() === choice.value ? "true" : "false")}
            onTap={() => onChange(choice.value)}
          >
            {choice.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The palette picker shows each ramp rather than naming it, and each swatch is
 * built from the same stops the field is drawn from — a swatch written out
 * separately is one that eventually disagrees with the field.
 */
function paletteChooser(physicsLab: PhysicsLab, config: ConfigGetter) {
  return (
    <div class="dsm-physics-lab-palettes" role="group" aria-label="Palette">
      <div class="dsm-physics-lab-label">Palette</div>
      <div class="dsm-physics-lab-palette-row">
        {PALETTE_IDS.map((id: PaletteID) => (
          <span
            role="button"
            tabIndex={0}
            title={PALETTES[id].name}
            aria-label={PALETTES[id].name}
            aria-pressed={() =>
              config().slope.palette === id ? "true" : "false"
            }
            class={() => ({
              "dsm-physics-lab-palette": true,
              "dsm-physics-lab-palette-selected": config().slope.palette === id,
            })}
            style={() => ({ background: paletteCSSGradient(id) })}
            onTap={() =>
              physicsLab.session.updateConfig((c) => {
                c.slope.palette = id;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function colorSwatch(physicsLab: PhysicsLab, config: ConfigGetter) {
  return (
    <label class="dsm-physics-lab-control" for="dsm-physics-lab-fixed-color">
      <span class="dsm-physics-lab-label">Colour</span>
      <input
        id="dsm-physics-lab-fixed-color"
        type="color"
        onUpdate={(element: HTMLInputElement) => {
          if (document.activeElement !== element)
            element.value = config().slope.fixedColor;
        }}
        onInput={(event: Event) =>
          physicsLab.session.updateConfig((c) => {
            c.slope.fixedColor = (event.target as HTMLInputElement).value;
          })
        }
      />
    </label>
  );
}

function numberControl(
  id: string,
  label: string,
  value: () => number,
  onChange: (value: number) => void
) {
  return (
    <label class="dsm-physics-lab-number" for={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        step="any"
        onUpdate={(element: HTMLInputElement) => {
          // Never fight the user mid-edit; only re-sync a field they left.
          if (document.activeElement !== element)
            element.value = String(value());
        }}
        onChange={(event: Event) => commitNumber(event, onChange)}
        onInput={(event: Event) => commitNumber(event, onChange)}
      />
    </label>
  );
}

function commitNumber(event: Event, onChange: (value: number) => void) {
  const raw = (event.target as HTMLInputElement).value;
  // An empty or half-typed value ("-", "1e") is not a number yet; leaving the
  // stored value alone lets the user finish typing.
  if (raw.trim() === "") return;
  const next = Number(raw);
  if (Number.isFinite(next)) onChange(next);
}

function checkboxControl(
  label: string,
  checked: () => boolean,
  onChange: (checked: boolean) => void
) {
  return (
    <label class="dsm-physics-lab-checkbox">
      <input
        type="checkbox"
        onUpdate={(element: HTMLInputElement) => {
          // Assigned as a property: an attribute of `checked="false"` is still
          // a checked box.
          element.checked = checked();
        }}
        onChange={(event: Event) =>
          onChange((event.target as HTMLInputElement).checked)
        }
      />
      {label}
    </label>
  );
}

export function PhysicsLabPanelFunc(physicsLab: PhysicsLab) {
  return <PhysicsLabPanel physicsLab={() => physicsLab} />;
}
