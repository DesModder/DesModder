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
  For,
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
import type { ExactReading, ShownStep } from "../PhysicsLabSession";
import { secondOrderHint } from "../symbolic/secondOrder";
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
/**
 * The variables a derivative can be taken with respect to.
 *
 * A short list rather than a free text field: every other name in an expression
 * is held constant, so the choice is between the handful of letters somebody
 * actually writes a function in. `t` is here because half of physics is.
 */
const VARIABLES: readonly Choice<string>[] = [
  { value: "x", label: "x" },
  { value: "t", label: "t" },
  { value: "y", label: "y" },
  { value: "r", label: "r" },
];

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
            second: () => secondOrderTab(physicsLab, config),
            derivative: () => derivativeTab(physicsLab, config),
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

      {initialCondition(physicsLab, config)}

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

      {/* Folded away, the way Vector Tools folds its flow's secondary
          controls. These refine a picture that already exists; the equation and
          the domain decide what it *is*, and putting all of them in one column
          makes none of them look more important than another. */}
      <details class="dsm-physics-lab-details">
        <summary>Appearance</summary>
        <div class="dsm-physics-lab-section">
          <div class="dsm-physics-lab-row">
            {numberControl(
              "dsm-physics-lab-mark-length",
              "Mark length",
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
          </div>
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
        </div>
      </details>

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

/**
 * The point the solution has to pass through.
 *
 * Sits directly under the general solution, because it is the second half of
 * the same question: "solve it" and "find the particular solution through
 * (0, 2)" are one exam problem, not two. Empty fields mean no condition, which
 * is the general solution with its slider — so this costs nothing to ignore.
 */
function initialCondition(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const result = () => session().particular;
  const found = () => {
    const value = result();
    return value?.ok === true ? value : undefined;
  };
  const failure = () => {
    const value = result();
    return value?.ok === false ? value.error : "";
  };
  const point = (
    which: "xLatex" | "yLatex",
    label: string,
    kind: "initial-x" | "initial-y"
  ) => (
    <label class="dsm-physics-lab-point">
      <span>{label}</span>
      <InlineMathInputViewGeneral
        containerClass={() => ({ "dsm-physics-lab-math-input": true })}
        placeholder="0"
        ariaLabel={label}
        latex={() => config().initial[which]}
        handleLatexChanged={(latex: string) =>
          session().updateConfig((c) => {
            c.initial[which] = latex;
          })
        }
        hasError={() => false}
        manageFocus={mathquillFocusHelper({
          controller: physicsLab.cc,
          location: { type: "dsm-focus", plugin: "physics-lab", kind },
        })}
        controller={physicsLab.cc}
        readonly={false}
      />
    </label>
  );
  return (
    <section class="dsm-physics-lab-section">
      <h3>Through a point</h3>
      <div class="dsm-physics-lab-row">
        {point("xLatex", "x₀", "initial-x")}
        {point("yLatex", "y₀", "initial-y")}
      </div>
      <If predicate={() => found() !== undefined}>
        {() => (
          <div class="dsm-physics-lab-solution">
            <div
              class="dsm-physics-lab-math"
              data-physics-lab="particular"
              data-latex={() => found()?.latex ?? ""}
            >
              <StaticMathQuillView latex={() => found()?.latex ?? ""} />
            </div>
            <div class="dsm-physics-lab-inline">
              <Button
                color="blue"
                class="dsm-physics-lab-add-particular"
                onTap={() => session().insertParticular()}
              >
                Add particular solution
              </Button>
            </div>
          </div>
        )}
      </If>
      <If predicate={() => failure() !== ""}>
        {() => <div class="dsm-physics-lab-hint">{() => failure()}</div>}
      </If>
    </section>
  );
}

/**
 * Second-order equations, on their own tab.
 *
 * Separate from the slope field rather than folded into it, because they are
 * different objects: a slope field is a first-order picture and there is no 2D
 * drawing of a second-order equation to sit beside it. Conditionally hiding
 * half the slope tab would have said the same thing less clearly.
 */
function secondOrderTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const result = () => session().secondOrderSolution;
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
      <section class="dsm-physics-lab-section">
        <label class="dsm-physics-lab-label">d²y/dx² =</label>
        <InlineMathInputViewGeneral
          containerClass={() => ({ "dsm-physics-lab-math-input": true })}
          placeholder="-y'-4y"
          ariaLabel="the second derivative in terms of y and v"
          latex={() => config().secondOrder.fLatex}
          handleLatexChanged={(latex: string) =>
            session().updateConfig((c) => {
              c.secondOrder.fLatex = latex;
            })
          }
          hasError={() => false}
          manageFocus={mathquillFocusHelper({
            controller: physicsLab.cc,
            location: {
              type: "dsm-focus",
              plugin: "physics-lab",
              kind: "second-f",
            },
          })}
          controller={physicsLab.cc}
          readonly={false}
        />
        {/* `v` rather than `y'` is not a shorthand this invented. Desmos's
            parser rejects `y'` outright, and v is the substitution every
            textbook makes — and the velocity the physics is usually about. */}
        <div class="dsm-physics-lab-hint">{secondOrderHint}</div>
        <If predicate={() => solved() !== undefined}>
          {() => (
            <div class="dsm-physics-lab-solution">
              <div
                class="dsm-physics-lab-math"
                data-physics-lab="second-solution"
                data-latex={() => solved()?.latex ?? ""}
              >
                <StaticMathQuillView latex={() => solved()?.latex ?? ""} />
              </div>
              <div class="dsm-physics-lab-inline">
                <Button
                  color="blue"
                  class="dsm-physics-lab-add-second"
                  onTap={() => session().insertSecondOrderSolution()}
                >
                  Add solution to graph
                </Button>
                <span class="dsm-physics-lab-method">
                  {() => solved()?.method ?? ""}
                </span>
              </div>
              <div class="dsm-physics-lab-hint">
                Two constants, so Desmos offers two sliders — one family in each
                of them.
              </div>
            </div>
          )}
        </If>
        <If predicate={() => failure() !== ""}>
          {() => <div class="dsm-physics-lab-hint">{() => failure()}</div>}
        </If>
      </section>

      <section class="dsm-physics-lab-section">
        <div class="dsm-physics-lab-section-head">
          <h3>Phase plane</h3>
          <Button
            color="light-gray"
            class="dsm-physics-lab-match-phase"
            onTap={() => matchPhaseViewport(physicsLab)}
          >
            Match viewport
          </Button>
        </div>
        {/* Its own coordinates, and saying so is the whole point: the marks are
            not over x and y, so reading them as a slope field would be reading
            a different equation. */}
        <div class="dsm-physics-lab-hint">
          y across, y′ up. A second-order equation has no direction field over x
          and y — the slope at a point depends on the velocity there too — but
          against y and y′ it does, and that is the picture the behaviour is
          read from.
        </div>
        {phaseAxis(physicsLab, config, "x", "y")}
        {phaseAxis(physicsLab, config, "y", "y′")}
      </section>

      <div class="dsm-physics-lab-footer">
        <div class="dsm-physics-lab-status">
          {() => physicsLab.session.status}
        </div>
        <div class="dsm-physics-lab-actions">
          <Button
            color="blue"
            class="dsm-physics-lab-draw-phase"
            onTap={() => physicsLab.session.togglePhasePlane()}
          >
            {() =>
              physicsLab.session.isDrawingPhase
                ? "Stop drawing"
                : "Draw phase plane"
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One axis of the phase plane, labelled by what it holds rather than by x/y. */
function phaseAxis(
  physicsLab: PhysicsLab,
  config: ConfigGetter,
  axis: "x" | "y",
  label: string
) {
  const session = () => physicsLab.session;
  const count = axis === "x" ? "columns" : "rows";
  return (
    <div class="dsm-physics-lab-axis">
      {numberControl(
        `dsm-physics-lab-phase-${axis}-minimum`,
        `${label} min`,
        () => config().phase.domain[axis].min,
        (value) =>
          session().updateConfig((c) => {
            c.phase.domain[axis].min = value;
          })
      )}
      {numberControl(
        `dsm-physics-lab-phase-${axis}-maximum`,
        `${label} max`,
        () => config().phase.domain[axis].max,
        (value) =>
          session().updateConfig((c) => {
            c.phase.domain[axis].max = value;
          })
      )}
      {numberControl(
        `dsm-physics-lab-phase-${axis}-count`,
        "arrows",
        () => config().phase[count],
        (value) =>
          session().updateConfig((c) => {
            c.phase[count] = Math.round(
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

function matchPhaseViewport(physicsLab: PhysicsLab) {
  const bounds = physicsLab.calc.graphpaperBounds.mathCoordinates;
  physicsLab.session.updateConfig((config) => {
    config.phase.domain.x = {
      min: round(bounds.left),
      max: round(bounds.right),
    };
    config.phase.domain.y = {
      min: round(bounds.bottom),
      max: round(bounds.top),
    };
  });
}

/**
 * The derivative, and how it was got.
 *
 * The steps are the tab, not an extra on it. An answer alone is what Desmos
 * already refuses to give and what a student cannot check; the sequence of
 * rules is the part that transfers to the next problem, so it is shown by
 * default rather than folded away behind a disclosure.
 */
function derivativeTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const found = () => session().derivation;
  const worked = () => {
    const value = found();
    return value?.ok === true ? value : undefined;
  };
  const failure = () => {
    const value = found();
    return value?.ok === false && value.error !== "" ? value.error : "";
  };
  const variable = () => config().derivative.variable;

  return (
    <div>
      <section class="dsm-physics-lab-section">
        <div class="dsm-physics-lab-section-head">
          <label class="dsm-physics-lab-label">
            {() => `d/d${variable()} of`}
          </label>
          {chipGroup(
            "With respect to",
            variable,
            VARIABLES,
            (value) =>
              session().updateConfig((c) => {
                c.derivative.variable = value;
              }),
            "dsm-physics-lab-derivative-variable"
          )}
        </div>
        <InlineMathInputViewGeneral
          containerClass={() => ({ "dsm-physics-lab-math-input": true })}
          placeholder="x^{2}\sin\left(3x\right)"
          ariaLabel="the expression to differentiate"
          latex={() => config().derivative.fLatex}
          handleLatexChanged={(latex: string) =>
            session().updateConfig((c) => {
              c.derivative.fLatex = latex;
            })
          }
          hasError={() => failure() !== ""}
          manageFocus={mathquillFocusHelper({
            controller: physicsLab.cc,
            location: {
              type: "dsm-focus",
              plugin: "physics-lab",
              kind: "derivative-f",
            },
          })}
          controller={physicsLab.cc}
          readonly={false}
        />
        <If predicate={() => failure() !== ""}>
          {() => <div class="dsm-physics-lab-hint">{() => failure()}</div>}
        </If>
      </section>

      <If predicate={() => worked() !== undefined}>
        {() => (
          <div>
            <section class="dsm-physics-lab-section">
              <div class="dsm-physics-lab-solution">
                <div
                  class="dsm-physics-lab-math"
                  data-physics-lab="derivative"
                  data-latex={() => worked()?.resultLatex ?? ""}
                >
                  <StaticMathQuillView
                    latex={() => worked()?.resultLatex ?? ""}
                  />
                </div>
                <div class="dsm-physics-lab-inline">
                  <Button
                    color="blue"
                    class="dsm-physics-lab-add-derivative"
                    onTap={() => session().insertDerivative()}
                  >
                    Add to graph
                  </Button>
                </div>
              </div>
            </section>

            <section class="dsm-physics-lab-section">
              <h3>Step by step</h3>
              <ol class="dsm-physics-lab-steps">
                <For
                  each={() => worked()?.shown ?? []}
                  key={(step: ShownStep) => step.key}
                >
                  {(getStep: () => ShownStep) => (
                    <li
                      class="dsm-physics-lab-step"
                      style={() => ({
                        // Indented by how deep in the expression the rule was
                        // applied, so a sub-derivative reads as belonging to the
                        // rule that asked for it.
                        "margin-left": `${Math.min(getStep().depth, 4) * 10}px`,
                      })}
                    >
                      <div class="dsm-physics-lab-step-title">
                        {() => getStep().title}
                      </div>
                      <div class="dsm-physics-lab-hint">
                        {() => getStep().detail}
                      </div>
                      <If predicate={() => getStep().formula !== ""}>
                        {() => (
                          <div class="dsm-physics-lab-math dsm-physics-lab-formula">
                            <StaticMathQuillView
                              latex={() => getStep().formula}
                            />
                          </div>
                        )}
                      </If>
                      <div class="dsm-physics-lab-math">
                        <StaticMathQuillView latex={() => getStep().latex} />
                      </div>
                    </li>
                  )}
                </For>
              </ol>
            </section>

            {/* Built from the user's own expression by changing its numbers, so
                it is guaranteed to need exactly the rules just shown. Its answer
                is given and its steps are not — the point is to try it. */}
            <If predicate={() => worked()?.example !== undefined}>
              {() => (
                <section class="dsm-physics-lab-section">
                  <h3>Now try this one</h3>
                  <div class="dsm-physics-lab-math">
                    <StaticMathQuillView
                      latex={() =>
                        `\\frac{d}{d${variable()}}\\left(${worked()?.example?.source ?? ""}\\right)`
                      }
                    />
                  </div>
                  <details class="dsm-physics-lab-details">
                    <summary>Answer</summary>
                    <div
                      class="dsm-physics-lab-math"
                      data-physics-lab="example-answer"
                      data-latex={() => worked()?.example?.result ?? ""}
                    >
                      <StaticMathQuillView
                        latex={() => worked()?.example?.result ?? ""}
                      />
                    </div>
                  </details>
                </section>
              )}
            </If>
          </div>
        )}
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
          Desmos answers every constant with a decimal. Type an expression to
          see the form it is written in — or paste one of those decimals back to
          find out what it was.
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
                {/* A derived value and a matched one are different claims, and
                    the panel says which. Infinitely many constants agree with
                    any finite decimal, so a match is a candidate that fits
                    every digit given — not a fact about the number. */}
                <span class="dsm-physics-lab-decimal">
                  {() => {
                    const value = reading();
                    if (value === undefined) return "";
                    const digits = value.matched;
                    return digits === undefined
                      ? `≈ ${value.value.toPrecision(12)}`
                      : `matches all ${digits} digits you gave`;
                  }}
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
