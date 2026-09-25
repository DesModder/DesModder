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
  type AnswerForm,
  type DetailLevel,
  type ExplainLevel,
  type LimitDirection,
  type PhysicsLabConfig,
} from "../model";
import type { VectorColorMode } from "../../../field-rendering/types";
import {
  PALETTES,
  PALETTE_IDS,
  paletteCSSGradient,
  type PaletteID,
} from "../../../field-rendering/palettes";
import type {
  AttemptVerdict,
  ExactReading,
  LimitLineView,
  LimitSideView,
  LimitStepView,
  ShownStep,
} from "../PhysicsLabSession";
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

/**
 * How much of a derivation to show.
 *
 * Both render the same tree — `full` stops hiding the atomic facts. Nothing is
 * recomputed, so the two views cannot say different things.
 */
/**
 * An antiderivative, or a number between two bounds. Chips rather than a
 * checkbox because both are answers and neither is the absence of the other.
 */
const INTEGRAL_KINDS: readonly Choice<"indefinite" | "definite">[] = [
  { value: "indefinite", label: "Antiderivative" },
  { value: "definite", label: "Between bounds" },
];

const DETAIL_LEVELS: readonly Choice<DetailLevel>[] = [
  { value: "standard", label: "Standard" },
  { value: "full", label: "Every step" },
];

/** Two ways of writing the same function, neither more correct than the other. */
const ANSWER_FORMS: readonly Choice<AnswerForm>[] = [
  { value: "expanded", label: "Expanded" },
  { value: "factored", label: "Factored" },
];

/**
 * What marking an attempt can say.
 *
 * "Not yet" rather than "wrong": the answer is still on screen to fix, and the
 * reader is being told where they are rather than graded.
 */
const VERDICTS: Record<AttemptVerdict, string> = {
  correct: "That is the derivative.",
  wrong: "Not yet — that is a different function.",
  unreadable: "That does not evaluate to anything here.",
};

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
            limit: () => limitTab(physicsLab, config),
            derivative: () => derivativeTab(physicsLab, config),
            integral: () => integralTab(physicsLab, config),
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
 *
 * Two things about the layout are load-bearing rather than decorative.
 *
 * It is a **tree**. Every row carries the depth it sits at and is indented and
 * ruled by it, so "chain rule" reads as something logarithmic differentiation
 * asked for rather than as the next item in a list. The labels — `1`, `1a`,
 * `1b-i` — say the same thing for anyone reading rather than looking.
 *
 * And it is in **cause-and-effect order**. A rule announces itself and shows
 * itself applied with its sub-derivatives still outstanding; its children are
 * worked; only then is its own result assembled, in a row of its own below
 * them. No line uses a value the reader has not yet been shown how to get.
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
  const full = () => config().derivative.detail === "full";

  /**
   * The rows to draw.
   *
   * Filtered here rather than in the session, so switching the detail level
   * redraws the same derivation instead of asking for another one. There is
   * only ever one derivation, and therefore nothing that can disagree.
   */
  const rows = (): ShownStep[] =>
    (worked()?.shown ?? []).filter((row) => full() || !row.deep);

  /** Which form of the answer is on screen, and whether there is a choice. */
  const hasChoice = () => (worked()?.factoredLatex ?? "") !== "";
  const factoredShown = () =>
    hasChoice() && config().derivative.form === "factored";
  const answerLatex = () =>
    factoredShown()
      ? (worked()?.factoredLatex ?? "")
      : (worked()?.resultLatex ?? "");
  const answerLines = () =>
    (factoredShown() ? worked()?.factoredLines : worked()?.resultLines) ?? [];

  const example = () => worked()?.example;
  const hints = () =>
    (example()?.hints ?? []).slice(0, config().derivative.hintsShown);
  const moreHints = () =>
    config().derivative.hintsShown < (example()?.hints.length ?? 0);
  const verdict = () => session().attemptVerdict;

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
            (value) => session().setDerivativeVariable(value),
            "dsm-physics-lab-derivative-variable"
          )}
        </div>
        <InlineMathInputViewGeneral
          containerClass={() => ({ "dsm-physics-lab-math-input": true })}
          placeholder="x^{2}\sin\left(3x\right)"
          ariaLabel="the expression to differentiate"
          latex={() => config().derivative.fLatex}
          handleLatexChanged={(latex: string) =>
            session().setDerivativeExpression(latex)
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
              {/* Two forms of one function. Neither is more correct, so the
                  panel offers both rather than picking one. */}
              <If predicate={hasChoice}>
                {() => (
                  <div class="dsm-physics-lab-section-head">
                    {chipGroup(
                      "Answer form",
                      () => config().derivative.form,
                      ANSWER_FORMS,
                      (value) => session().setAnswerForm(value),
                      "dsm-physics-lab-form"
                    )}
                  </div>
                )}
              </If>
              <div
                class="dsm-physics-lab-solution"
                data-physics-lab="derivative"
                data-latex={answerLatex}
              >
                {mathBlock(answerLatex, answerLines)}
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

              <If predicate={() => factoredShown()}>
                {() => (
                  <div class="dsm-physics-lab-factor-notes">
                    <For
                      each={() => worked()?.factorNotes ?? []}
                      key={(note: { key: string }) => note.key}
                    >
                      {(getNote: () => { text: string; latex: string }) => (
                        <div class="dsm-physics-lab-note">
                          <span class="dsm-physics-lab-hint">
                            {() => getNote().text}
                          </span>
                          <If predicate={() => getNote().latex !== ""}>
                            {() => (
                              <span class="dsm-physics-lab-math">
                                <StaticMathQuillView
                                  latex={() => getNote().latex}
                                />
                              </span>
                            )}
                          </If>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </If>

              {/* Where the method assumed something the question did not say. */}
              <If predicate={() => (worked()?.domain.length ?? 0) > 0}>
                {() => (
                  <div class="dsm-physics-lab-domain">
                    <span class="dsm-physics-lab-hint">
                      This derivation takes logs, so it is real-valued where
                    </span>
                    <For
                      each={() =>
                        (worked()?.domain ?? []).map((latex, index) => ({
                          key: String(index),
                          latex,
                        }))
                      }
                      key={(entry: { key: string }) => entry.key}
                    >
                      {(getEntry: () => { latex: string }) => (
                        <span class="dsm-physics-lab-math">
                          <StaticMathQuillView latex={() => getEntry().latex} />
                        </span>
                      )}
                    </For>
                  </div>
                )}
              </If>
            </section>

            <section class="dsm-physics-lab-section">
              <div class="dsm-physics-lab-section-head">
                <h3>Step by step</h3>
                {chipGroup(
                  "How much detail",
                  () => config().derivative.detail,
                  DETAIL_LEVELS,
                  (value) => session().setDetailLevel(value),
                  "dsm-physics-lab-detail"
                )}
              </div>
              <ol class="dsm-physics-lab-steps">
                <For each={rows} key={(row: ShownStep) => row.key}>
                  {(getRow: () => ShownStep) => stepRow(getRow, full)}
                </For>
              </ol>

              {/* Collecting terms is not a differentiation rule, and a row that
                  looked like one would teach that it is. */}
              <If predicate={() => (worked()?.rawLatex ?? "") !== ""}>
                {() => (
                  <div class="dsm-physics-lab-step dsm-physics-lab-tidy">
                    <div class="dsm-physics-lab-step-title">Tidy up</div>
                    <div class="dsm-physics-lab-hint">
                      No rule is applied here. The rules left it like this:
                    </div>
                    <div class="dsm-physics-lab-intermediate">
                      {mathBlock(
                        () => worked()?.rawLatex ?? "",
                        () => worked()?.rawLines ?? []
                      )}
                    </div>
                    <div class="dsm-physics-lab-hint">
                      Collecting it gives the same function, written more
                      briefly:
                    </div>
                    {mathBlock(
                      () => worked()?.resultLatex ?? "",
                      () => worked()?.resultLines ?? []
                    )}
                  </div>
                )}
              </If>
            </section>

            {/* Built from the user's own expression by changing its numbers, so
                it is guaranteed to need exactly the rules just shown — and the
                answer stays out of sight until it is asked for, because a
                solution sitting under the question is not a question. */}
            <If predicate={() => example() !== undefined}>
              {() => (
                <section class="dsm-physics-lab-section">
                  <h3>Now try this one</h3>
                  <div class="dsm-physics-lab-math">
                    <StaticMathQuillView
                      latex={() =>
                        `\\frac{d}{d${variable()}}\\left(${example()?.source ?? ""}\\right)`
                      }
                    />
                  </div>

                  <label class="dsm-physics-lab-label">Your answer</label>
                  <InlineMathInputViewGeneral
                    containerClass={() => ({
                      "dsm-physics-lab-math-input": true,
                    })}
                    placeholder=""
                    ariaLabel="your answer to the practice problem"
                    latex={() => config().derivative.attemptLatex}
                    handleLatexChanged={(latex: string) =>
                      session().setAttempt(latex)
                    }
                    hasError={() => verdict() === "wrong"}
                    manageFocus={mathquillFocusHelper({
                      controller: physicsLab.cc,
                      location: {
                        type: "dsm-focus",
                        plugin: "physics-lab",
                        kind: "derivative-attempt",
                      },
                    })}
                    controller={physicsLab.cc}
                    readonly={false}
                  />
                  {/* Marked by evaluating both, not by comparing strings: the
                      same derivative written with its terms in the other order
                      is the same derivative. */}
                  <If predicate={() => verdict() !== undefined}>
                    {() => (
                      <div
                        class={() => ({
                          "dsm-physics-lab-verdict": true,
                          "dsm-physics-lab-verdict-correct":
                            verdict() === "correct",
                        })}
                        data-physics-lab="verdict"
                        data-verdict={() => verdict() ?? ""}
                      >
                        {() => VERDICTS[verdict() ?? "unreadable"]}
                      </div>
                    )}
                  </If>

                  <div class="dsm-physics-lab-inline">
                    <If predicate={moreHints}>
                      {() => (
                        <Button
                          color="light-gray"
                          class="dsm-physics-lab-hint-button"
                          onTap={() => session().revealHint()}
                        >
                          Hint
                        </Button>
                      )}
                    </If>
                    <Button
                      color="blue"
                      class="dsm-physics-lab-check-answer"
                      onTap={() => session().checkAttempt()}
                    >
                      Check answer
                    </Button>
                    <If predicate={() => !config().derivative.showAnswer}>
                      {() => (
                        <Button
                          color="light-gray"
                          class="dsm-physics-lab-show-answer"
                          onTap={() => session().revealExampleAnswer()}
                        >
                          Show solution
                        </Button>
                      )}
                    </If>
                  </div>

                  {/* Progressive: the shape, then the pieces, then the hard
                      part. Handing over the substitutions at the first press
                      would end the exercise, and the recognition is the
                      exercise. */}
                  <If predicate={() => hints().length > 0}>
                    {() => (
                      <ol class="dsm-physics-lab-hints">
                        <For
                          each={hints}
                          key={(hint: { key: string }) => hint.key}
                        >
                          {(
                            getHint: () => { text: string; show: string[] }
                          ) => (
                            <li>
                              <span class="dsm-physics-lab-hint">
                                {() => getHint().text}
                              </span>
                              <For
                                each={() =>
                                  getHint().show.map((latex, index) => ({
                                    key: String(index),
                                    latex,
                                  }))
                                }
                                key={(entry: { key: string }) => entry.key}
                              >
                                {(getEntry: () => { latex: string }) => (
                                  <div class="dsm-physics-lab-math">
                                    <StaticMathQuillView
                                      latex={() => getEntry().latex}
                                    />
                                  </div>
                                )}
                              </For>
                            </li>
                          )}
                        </For>
                      </ol>
                    )}
                  </If>

                  <If predicate={() => config().derivative.showAnswer}>
                    {() => (
                      <div>
                        <label class="dsm-physics-lab-label">Answer</label>
                        <div
                          class="dsm-physics-lab-math"
                          data-physics-lab="example-answer"
                          data-latex={() => example()?.result ?? ""}
                        >
                          <StaticMathQuillView
                            latex={() => example()?.result ?? ""}
                          />
                        </div>
                      </div>
                    )}
                  </If>
                </section>
              )}
            </If>
          </div>
        )}
      </If>
    </div>
  );
}

/**
 * One row of the derivation.
 *
 * The heading is the *sub-problem* — "Differentiate u", beside the
 * subexpression it means — rather than the rule name, with the rule named
 * underneath it. Which part of the original is being worked on is the thing a
 * reader loses first in a nested derivative, and a rule name does not say it.
 */
function stepRow(getRow: () => ShownStep, full: () => boolean) {
  const heading = () => {
    const row = getRow();
    const text = row.task === "" ? row.title : row.task;
    return row.label === "" ? text : `${row.label}. ${text}`;
  };
  /** Named separately from the heading only when the heading is the task. */
  const ruleName = () => {
    const row = getRow();
    return row.task === "" ? "" : row.title;
  };

  return (
    <li
      class={() => ({
        "dsm-physics-lab-step": true,
        // A structural decision is the thing to read. A sub-problem is the
        // thing to read next.
        "dsm-physics-lab-step-major": getRow().major,
        // Assembling a result is not a rule, and does not look like one.
        "dsm-physics-lab-step-joining": getRow().kind !== "rule",
      })}
      style={() => ({
        // Indented by how deep in the expression the rule was applied, so a
        // sub-derivation reads as belonging to the rule that asked for it.
        "margin-left": `${Math.min(getRow().depth, 4) * 12}px`,
      })}
    >
      <div class="dsm-physics-lab-step-head">
        <span class="dsm-physics-lab-step-title">{heading}</span>
        <If predicate={() => getRow().focus !== ""}>
          {() => (
            <span class="dsm-physics-lab-math dsm-physics-lab-focus">
              <StaticMathQuillView latex={() => getRow().focus} />
            </span>
          )}
        </If>
      </div>
      <If predicate={() => ruleName() !== ""}>
        {() => <div class="dsm-physics-lab-rule-name">{ruleName}</div>}
      </If>
      <If predicate={() => getRow().recognition !== ""}>
        {() => (
          <div class="dsm-physics-lab-hint">{() => getRow().recognition}</div>
        )}
      </If>

      {/* The pieces the rule split the problem into. Naming them is what makes
          the formula beside it readable. */}
      <If predicate={() => getRow().substitutions.length > 0}>
        {() => (
          <div class="dsm-physics-lab-subs">
            <For
              each={() => getRow().substitutions}
              key={(entry: { symbol: string }) => entry.symbol}
            >
              {(getSub: () => { symbol: string; latex: string }) => (
                <span class="dsm-physics-lab-sub">
                  <span class="dsm-physics-lab-sub-symbol">
                    {() => `${getSub().symbol} =`}
                  </span>
                  <span class="dsm-physics-lab-math">
                    <StaticMathQuillView latex={() => getSub().latex} />
                  </span>
                </span>
              )}
            </For>
          </div>
        )}
      </If>

      <If predicate={() => getRow().formula !== ""}>
        {() => (
          <div class="dsm-physics-lab-math dsm-physics-lab-formula">
            <StaticMathQuillView latex={() => getRow().formula} />
          </div>
        )}
      </If>
      <If predicate={() => getRow().detail !== ""}>
        {() => <div class="dsm-physics-lab-hint">{() => getRow().detail}</div>}
      </If>

      {/* Where the rule comes from, for readers who would rather see it than
          take it. Only in the full view: in the standard one the formula is
          the thing being used, not the thing being proved. */}
      <If predicate={() => full() && getRow().derivation.length > 0}>
        {() => (
          <ol class="dsm-physics-lab-rule-derivation">
            <For
              each={() => getRow().derivation}
              key={(line: { key: string }) => line.key}
            >
              {(getLine: () => { latex: string; note: string }) => (
                <li>
                  <span class="dsm-physics-lab-hint">
                    {() => getLine().note}
                  </span>
                  <div class="dsm-physics-lab-math">
                    <StaticMathQuillView latex={() => getLine().latex} />
                  </div>
                </li>
              )}
            </For>
          </ol>
        )}
      </If>

      {/* The rule applied, with the smaller derivatives still to do. Jumping
          straight to the expanded answer hides the move being taught. */}
      <If predicate={() => getRow().intermediate !== ""}>
        {() => (
          <div class="dsm-physics-lab-math dsm-physics-lab-intermediate">
            <StaticMathQuillView latex={() => getRow().intermediate} />
          </div>
        )}
      </If>
      <If predicate={() => getRow().latex !== ""}>
        {() =>
          mathBlock(
            () => getRow().latex,
            () => getRow().lines
          )
        }
      </If>
    </li>
  );
}

/**
 * An expression, over several lines when one would run off the side.
 *
 * Horizontal scrolling is worse for maths than for anything else on a panel: an
 * expression laid out as one line loses its shape the moment half of it is off
 * screen, and the shape is what is being read.
 */
function mathBlock(latex: () => string, lines: () => string[]) {
  return (
    <div>
      <If predicate={() => lines().length > 1}>
        {() => (
          <div class="dsm-physics-lab-answer-lines">
            <For
              each={() =>
                lines().map((line, index) => ({ key: String(index), line }))
              }
              key={(entry: { key: string }) => entry.key}
            >
              {(getEntry: () => { line: string }) => (
                <div class="dsm-physics-lab-math">
                  <StaticMathQuillView latex={() => getEntry().line} />
                </div>
              )}
            </For>
          </div>
        )}
      </If>
      <If predicate={() => lines().length <= 1}>
        {() => (
          <div class="dsm-physics-lab-math">
            <StaticMathQuillView latex={latex} />
          </div>
        )}
      </If>
    </div>
  );
}

/**
 * The Integral tab.
 *
 * Shorter than the derivative tab beside it, and deliberately so. A derivation
 * is a sequence of rules and reads as one; an integral is found by search, and
 * the honest thing to put on screen is the answer, whether it was checked, and
 * — when there is no elementary answer — the series that is one.
 */
function integralTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const found = () => session().integral;
  const worked = () => {
    const value = found();
    return value?.ok === true ? value : undefined;
  };
  const failure = () => {
    const value = found();
    return value?.ok === false ? value : undefined;
  };
  const series = () => failure()?.series;
  const variable = () => config().integral.variable;
  const definiteResult = () => worked()?.definite;
  const definiteWorked = () => {
    const value = definiteResult();
    return value?.ok === true ? value : undefined;
  };
  const definiteFailed = () => {
    const value = definiteResult();
    return value?.ok === false ? value : undefined;
  };

  return (
    <div>
      <section class="dsm-physics-lab-section">
        <div class="dsm-physics-lab-section-head">
          <label class="dsm-physics-lab-label">Integrate</label>
          {chipGroup(
            "With respect to",
            variable,
            VARIABLES,
            (value) => session().setIntegralVariable(value),
            "dsm-physics-lab-integral-variable"
          )}
        </div>
        <div class="dsm-physics-lab-integrand">
          {/* The sign is a glyph rather than rendered maths. MathQuill draws
              `\int` on its own with its two limit slots empty, and an empty
              slot is drawn as a grey box — so the one symbol that says what
              this tab does would arrive looking like a control waiting to be
              filled in. */}
          <span class="dsm-physics-lab-integral-sign">∫</span>
          <InlineMathInputViewGeneral
            containerClass={() => ({ "dsm-physics-lab-math-input": true })}
            placeholder="x\sin\left(x\right)"
            ariaLabel="the expression to integrate"
            latex={() => config().integral.fLatex}
            handleLatexChanged={(latex: string) =>
              session().setIntegralExpression(latex)
            }
            // Red only when nothing at all came back. A refusal with a series
            // under it, or one that names the special function, is an answer
            // about the integral, and a red line reads as "you typed it wrong".
            hasError={() =>
              (failure()?.error ?? "") !== "" &&
              failure()?.series === undefined &&
              failure()?.special === undefined
            }
            manageFocus={mathquillFocusHelper({
              controller: physicsLab.cc,
              location: {
                type: "dsm-focus",
                plugin: "physics-lab",
                kind: "integral-f",
              },
            })}
            controller={physicsLab.cc}
            readonly={false}
          />
          <span class="dsm-physics-lab-differential">
            <StaticMathQuillView latex={() => `d${variable()}`} />
          </span>
        </div>
        {chipGroup(
          "Find",
          () => (config().integral.definite ? "definite" : "indefinite"),
          INTEGRAL_KINDS,
          (value) => session().setIntegralDefinite(value === "definite"),
          "dsm-physics-lab-integral-kind"
        )}
        <If predicate={() => config().integral.definite}>
          {() => (
            <div class="dsm-physics-lab-bounds">
              {boundInput(physicsLab, config, "lower")}
              {boundInput(physicsLab, config, "upper")}
            </div>
          )}
        </If>
      </section>

      {/* The number, exactly, with its decimal beside it rather than in its
          place. Built only on an antiderivative that was already checked, and
          checked again against a numerical integration, which is what catches
          an antiderivative that jumps inside the interval. */}
      <If predicate={() => definiteResult() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-solution"
              data-physics-lab="integral-definite"
              data-latex={() => definiteWorked()?.valueLatex ?? ""}
            >
              <If predicate={() => definiteWorked() !== undefined}>
                {() => (
                  <div>
                    <div class="dsm-physics-lab-math">
                      <StaticMathQuillView
                        latex={() =>
                          `${definiteWorked()?.statementLatex ?? ""}=${definiteWorked()?.valueLatex ?? ""}`
                        }
                      />
                    </div>
                    <div class="dsm-physics-lab-inline">
                      <Button
                        color="blue"
                        class="dsm-physics-lab-add-definite"
                        onTap={() => session().insertDefinite()}
                      >
                        Add to graph
                      </Button>
                      <span class="dsm-physics-lab-decimal">
                        {() => definiteWorked()?.decimal ?? ""}
                      </span>
                    </div>
                    <div class="dsm-physics-lab-hint">
                      {() => definiteWorked()?.note ?? ""}
                    </div>
                  </div>
                )}
              </If>
              <If predicate={() => definiteFailed() !== undefined}>
                {() => (
                  <div
                    class="dsm-physics-lab-refusal"
                    data-physics-lab="integral-definite-refusal"
                  >
                    {() => definiteFailed()?.error ?? ""}
                  </div>
                )}
              </If>
            </div>
          </section>
        )}
      </If>

      <If predicate={() => worked() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-solution"
              data-physics-lab="integral"
              data-latex={() => worked()?.latex ?? ""}
            >
              {mathBlock(
                () => worked()?.latex ?? "",
                () => worked()?.lines ?? []
              )}
              {/* Named by the branch that finished it, the way the ODE
                  readout names its method -- never guessed from the answer,
                  since one arctangent can come from four techniques. */}
              <div
                class="dsm-physics-lab-method"
                data-physics-lab="integral-method"
              >
                {() => worked()?.method ?? ""}
              </div>
              <div class="dsm-physics-lab-inline">
                <Button
                  color="blue"
                  class="dsm-physics-lab-add-integral"
                  onTap={() => session().insertIntegral()}
                >
                  Add to graph
                </Button>
                {/* Said only where it is true. An answer that was checked and
                    one that could not be is a different claim, and the absence
                    of this line is the second one. */}
                <span class="dsm-physics-lab-decimal">
                  {() =>
                    worked()?.check === "checked"
                      ? "differentiates back to the integrand"
                      : "not checked — this uses a name nothing here gives a value to"
                  }
                </span>
              </div>
            </div>
            <div class="dsm-physics-lab-hint">
              C is undefined, so Desmos will offer a slider for it. Dragging it
              moves the curve through the whole family of antiderivatives.
            </div>
          </section>
        )}
      </If>

      {/* Nothing is said while an expression is half-typed: LaTeX that does not
          parse arrives with an empty message, and an error under a field
          somebody is still using reads as the tool complaining rather than as
          the tool waiting. */}
      <If predicate={() => (failure()?.error ?? "") !== ""}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-refusal"
              data-physics-lab="integral-refusal"
            >
              {() => failure()?.error ?? ""}
            </div>
            <If predicate={() => series() === undefined}>
              {() => (
                <div class="dsm-physics-lab-hint">
                  Refused rather than approximated. An answer that is nearly
                  right is not an antiderivative of anything.
                </div>
              )}
            </If>
          </section>
        )}
      </If>

      {/* The one thing that can be said about an integral with no elementary
          antiderivative, and it is an exact answer rather than a consolation:
          the sum *is* the function. */}
      <If predicate={() => series() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <h3>As a power series</h3>
            {/* Three different claims, and the sentence has to match the one
                being made. "There is none" is only true when the refusal named
                the special function; "none was found" is all a failed search
                can say. A truncated series is exact term by term and still
                only a beginning, and says so. */}
            <div class="dsm-physics-lab-hint">
              {() =>
                (failure()?.special !== undefined
                  ? "There is no elementary antiderivative, which is a fact about the function rather than a gap here. "
                  : "No elementary antiderivative was found. ") +
                (series()?.order !== undefined
                  ? "These are the first terms of its Maclaurin series, every coefficient exact; no general term was found, so the sum stops where the arithmetic did."
                  : "Integrating its series term by term gives one exactly.")
              }
            </div>
            <If predicate={() => (series()?.parts.length ?? 0) > 1}>
              {() => (
                <div
                  class="dsm-physics-lab-series-parts"
                  data-physics-lab="integral-series-parts"
                >
                  {/* Term by term, because a sum of a closed form and a series
                      is two kinds of answer and the reader should know which
                      part is which. */}
                  <For
                    each={() => series()?.parts ?? []}
                    key={(part: { latex: string; kind: string }) =>
                      `${part.kind} ${part.latex}`
                    }
                  >
                    {(part: () => { latex: string; kind: string }) => (
                      <div class="dsm-physics-lab-series-part">
                        <span class="dsm-physics-lab-math">
                          <StaticMathQuillView latex={() => part().latex} />
                        </span>
                        <span class="dsm-physics-lab-decimal">
                          {() =>
                            part().kind === "closed"
                              ? "in closed form"
                              : part().kind === "series"
                                ? "as a series, with its general term"
                                : "as the first terms of its series"
                          }
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </If>
            {/* The ellipsis is set beside the maths rather than inside it.
                MathQuill has no `\dots`, and a field it cannot parse renders
                as nothing at all — so the line that makes the series
                recognisable was the one line that disappeared. */}
            <div class="dsm-physics-lab-partial">
              <div class="dsm-physics-lab-math">
                <StaticMathQuillView
                  latex={() => series()?.partialLatex ?? ""}
                />
              </div>
              <span class="dsm-physics-lab-ellipsis">+ ⋯</span>
            </div>
            <div
              class="dsm-physics-lab-solution"
              data-physics-lab="integral-series"
              data-latex={() => series()?.sumLatex ?? ""}
            >
              <div class="dsm-physics-lab-math">
                <StaticMathQuillView latex={() => series()?.sumLatex ?? ""} />
              </div>
              <div class="dsm-physics-lab-inline">
                <Button
                  color="blue"
                  class="dsm-physics-lab-add-series"
                  onTap={() => session().insertSeries()}
                >
                  Add to graph
                </Button>
                <span class="dsm-physics-lab-decimal">
                  {() => {
                    const found = series();
                    if (found === undefined) return "";
                    return found.order === undefined
                      ? `converges for ${found.interval}`
                      : `exact below x${superscript(found.order)}, for x near 0`;
                  }}
                </span>
              </div>
            </div>
            {/* The sum that goes into the graph stops somewhere, and where it
                stops is the reader's trade rather than this panel's: more terms
                reach further out, fewer redraw faster under a moving slider. */}
            {/* In a row, because a number control's flex basis is read as a
                height by the column its section is, and one on its own would
                reserve eighty-eight pixels of nothing under itself. */}
            <div class="dsm-physics-lab-row">
              {numberControl(
                "dsm-physics-lab-series-terms",
                "Terms plotted",
                () => config().integral.terms,
                (value) => session().setSeriesTerms(value)
              )}
            </div>
            <div class="dsm-physics-lab-hint">
              The series is infinite and the plotted sum is not. Past the
              interval it converges on, and far enough out inside it, the curve
              is the sum rather than the function.
            </div>
          </section>
        )}
      </If>
    </div>
  );
}

/**
 * Which side a limit at a point is taken from. The marks are the ones written
 * after the point, so the chip says what the notation will say.
 */
/**
 * How deep an explanation goes. The same steps at each depth, so moving
 * between them cannot change the argument — only how much of it is spelled
 * out.
 */
const EXPLAIN_LEVELS: readonly Choice<ExplainLevel>[] = [
  { value: "simple", label: "Simple" },
  { value: "detailed", label: "With reasons" },
  { value: "research", label: "Proof" },
];

/** What a two-sided limit means at the edge of a function's domain. */
const CONVENTIONS: readonly Choice<"bilateral" | "domain">[] = [
  { value: "bilateral", label: "Both sides required" },
  { value: "domain", label: "Within the domain" },
];

const LIMIT_SIDES: readonly Choice<LimitDirection>[] = [
  { value: "both", label: "Both sides" },
  { value: "left", label: "From the left  a⁻" },
  { value: "right", label: "From the right  a⁺" },
];

/**
 * One line of a limit, set the way it is printed: `lim` upright with its
 * approach underneath, then the maths.
 *
 * Built rather than rendered as one `\lim_{x\to a}`. MathQuill here has no
 * `\lim` operator: it draws the three letters in italic, as a product l·i·m,
 * with the approach hanging off the side as a subscript — which reads as a
 * variable called lim rather than as the operator. `\operatorname{lim}` fixes
 * the letters and not the placement.
 */
function limitStatement(
  prefix: string,
  approach: () => string,
  rest: () => string
) {
  return (
    <div class="dsm-physics-lab-limit-line">
      {prefix === "" ? null : (
        <span class="dsm-physics-lab-math">
          <StaticMathQuillView latex={() => prefix} />
        </span>
      )}
      <span class="dsm-physics-lab-limit-operator">
        <span class="dsm-physics-lab-limit-word">lim</span>
        <span class="dsm-physics-lab-limit-under">
          <StaticMathQuillView latex={approach} />
        </span>
      </span>
      <span class="dsm-physics-lab-math">
        <StaticMathQuillView latex={rest} />
      </span>
    </div>
  );
}

/** Whether a point as typed is one of the infinities, where sides mean nothing. */
const isInfinity = (latex: string) =>
  /^[+-]?\\infty$/.test(latex.trim().replace(/\\left|\\right/g, ""));

/**
 * The Limit tab.
 *
 * Laid out the way a limit is written — `lim` with the approach beneath it,
 * then the expression — because the notation is what a student reads on a
 * worksheet, and a form that separated the pieces would have to be translated
 * back into it. The answer is a number, "does not exist" with its reason, or a
 * refusal, and those three are kept visibly different.
 */
function limitTab(physicsLab: PhysicsLab, config: ConfigGetter) {
  const session = () => physicsLab.session;
  const found = () => session().limit;
  const value = () => {
    const view = found();
    return view?.status === "value" ? view : undefined;
  };
  const none = () => {
    const view = found();
    return view?.status === "none" ? view : undefined;
  };
  const refused = () => {
    const view = found();
    return view?.status === "refused" ? view : undefined;
  };
  const variable = () => config().limit.variable;
  const formLatex = () => found()?.formLatex ?? "";
  const refusedSides = () => refused()?.sides ?? [];

  return (
    <div>
      <section class="dsm-physics-lab-section">
        <div class="dsm-physics-lab-section-head">
          <label class="dsm-physics-lab-label">Limit</label>
          {chipGroup(
            "Variable",
            variable,
            VARIABLES,
            (choice) => session().setLimitVariable(choice),
            "dsm-physics-lab-limit-variable"
          )}
        </div>
        <div class="dsm-physics-lab-limit">
          {/* The operator and its approach stacked, as it is printed. Built
              from a glyph and a field rather than rendered: a static `\lim`
              cannot hold an editable point under it. */}
          <div class="dsm-physics-lab-limit-operator">
            <span class="dsm-physics-lab-limit-word">lim</span>
            <div class="dsm-physics-lab-limit-approach">
              <span class="dsm-physics-lab-limit-arrow">
                <StaticMathQuillView latex={() => `${variable()}\\to`} />
              </span>
              <InlineMathInputViewGeneral
                containerClass={() => ({
                  "dsm-physics-lab-math-input": true,
                  "dsm-physics-lab-limit-point": true,
                })}
                placeholder="0"
                ariaLabel="the point the variable approaches"
                latex={() => config().limit.pointLatex}
                handleLatexChanged={(latex: string) =>
                  session().setLimitPoint(latex)
                }
                hasError={() =>
                  refused()?.error.startsWith("The point") === true
                }
                manageFocus={mathquillFocusHelper({
                  controller: physicsLab.cc,
                  location: {
                    type: "dsm-focus",
                    plugin: "physics-lab",
                    kind: "limit-point",
                  },
                })}
                controller={physicsLab.cc}
                readonly={false}
              />
            </div>
          </div>
          <InlineMathInputViewGeneral
            containerClass={() => ({ "dsm-physics-lab-math-input": true })}
            placeholder="\frac{\sin\left(x\right)}{x}"
            ariaLabel="the expression to take the limit of"
            latex={() => config().limit.fLatex}
            handleLatexChanged={(latex: string) =>
              session().setLimitExpression(latex)
            }
            hasError={() => false}
            manageFocus={mathquillFocusHelper({
              controller: physicsLab.cc,
              location: {
                type: "dsm-focus",
                plugin: "physics-lab",
                kind: "limit-f",
              },
            })}
            controller={physicsLab.cc}
            readonly={false}
          />
        </div>
        {/* At an infinity there is only one way to approach, so the choice
            is not offered rather than offered and ignored. */}
        <If predicate={() => !isInfinity(config().limit.pointLatex)}>
          {() =>
            chipGroup(
              "Approach",
              () => config().limit.side,
              LIMIT_SIDES,
              (side) => session().setLimitSide(side),
              "dsm-physics-lab-limit-side"
            )
          }
        </If>
      </section>

      {/* The form comes first because it is what is recognised first: a
          student sees 0/0 before choosing what to do about it. */}
      <If predicate={() => formLatex() !== ""}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-inline dsm-physics-lab-limit-form"
              data-physics-lab="limit-form"
              data-latex={formLatex}
            >
              <span class="dsm-physics-lab-label">Indeterminate form</span>
              <span class="dsm-physics-lab-math">
                <StaticMathQuillView latex={formLatex} />
              </span>
            </div>
            <div class="dsm-physics-lab-hint">
              Putting the point in gives no value, only a form, so the limit has
              to be found another way.
            </div>
          </section>
        )}
      </If>

      {/* The answer, stated first and whole. How it was reached comes after,
          at whatever depth the reader asks for. */}
      <If predicate={() => value() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-solution"
              data-physics-lab="limit"
              data-latex={() => value()?.valueLatex ?? ""}
            >
              {limitStatement(
                "",
                () => value()?.approachLatex ?? "",
                () => `${value()?.bodyLatex ?? ""}=${value()?.valueLatex ?? ""}`
              )}
              <If predicate={() => (value()?.caption ?? "") !== ""}>
                {() => (
                  <div
                    class="dsm-physics-lab-hint"
                    data-physics-lab="limit-caption"
                  >
                    {() => value()?.caption ?? ""}
                  </div>
                )}
              </If>
              <div class="dsm-physics-lab-inline">
                <If predicate={() => value()?.finite === true}>
                  {() => (
                    <Button
                      color="blue"
                      class="dsm-physics-lab-add-limit"
                      onTap={() => session().insertLimit()}
                    >
                      Add to graph
                    </Button>
                  )}
                </If>
                <Button
                  color="light-gray"
                  class="dsm-physics-lab-show-limit"
                  onTap={() => session().showLimitOnGraph()}
                >
                  Show on graph
                </Button>
                <span class="dsm-physics-lab-decimal">
                  {() => value()?.decimal ?? ""}
                </span>
              </div>
              {/* A diagnostic, and worded as one: no set of samples proves a
                  limit, and the proof is the working below. */}
              <div class="dsm-physics-lab-hint" data-physics-lab="limit-check">
                {() =>
                  value()?.check === "consistent"
                    ? "The function's values near the point are consistent with this at every distance tested."
                    : "The numbers near the point are inconclusive: it approaches too slowly for floating point to see it arrive. The answer rests on the working below."
                }
              </div>
              <If predicate={() => (value()?.note ?? "") !== ""}>
                {() => (
                  <div class="dsm-physics-lab-hint">
                    {() => value()?.note ?? ""}
                  </div>
                )}
              </If>
            </div>
          </section>
        )}
      </If>

      <If predicate={() => value() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div class="dsm-physics-lab-section-head">
              <h3>How</h3>
              {chipGroup(
                "Explain",
                () => config().limit.explain,
                EXPLAIN_LEVELS,
                (level) => session().setLimitExplain(level),
                "dsm-physics-lab-limit-explain"
              )}
            </div>
            {/* Every route that reaches the answer, the one a course would
                reach for first selected. One tap shows the same limit done
                another way, which is most of what makes a method stick. */}
            <If predicate={() => (value()?.routes.length ?? 0) > 0}>
              {() => (
                <div
                  class="dsm-physics-lab-chips"
                  id="dsm-physics-lab-limit-route"
                  role="group"
                  aria-label="Method"
                >
                  <div class="dsm-physics-lab-label">Method</div>
                  <div class="dsm-physics-lab-chip-row">
                    <For
                      each={() =>
                        (value()?.routes ?? []).map((route) => ({
                          key: route.id,
                          name: route.name,
                        }))
                      }
                      key={(route: { key: string }) => route.key}
                    >
                      {(route: () => { key: string; name: string }) => (
                        <span
                          role="button"
                          tabIndex={0}
                          data-value={() => route().key}
                          class={() => ({
                            "dsm-physics-lab-chip": true,
                            "dsm-physics-lab-chip-selected":
                              value()?.route === route().key,
                          })}
                          onTap={() => session().setLimitRoute(route().key)}
                        >
                          {() => route().name}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </If>
            {stepList(
              () => {
                const shown = value();
                return (
                  shown?.routes.find((r) => r.id === shown.route)?.steps ?? []
                );
              },
              () => value()?.route ?? "",
              () => config().limit.explain
            )}
          </section>
        )}
      </If>

      <If predicate={() => none() !== undefined}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div class="dsm-physics-lab-solution" data-physics-lab="limit-none">
              <div class="dsm-physics-lab-refusal">
                {() => none()?.reason ?? ""}
              </div>
              {sideLines(
                () => none()?.sides ?? [],
                () => config().limit.fLatex
              )}
              <div class="dsm-physics-lab-inline">
                <Button
                  color="light-gray"
                  class="dsm-physics-lab-show-limit"
                  onTap={() => session().showLimitOnGraph()}
                >
                  Show on graph
                </Button>
              </div>
            </div>
            <If predicate={() => (none()?.steps.length ?? 0) > 0}>
              {() => (
                <div>
                  <div class="dsm-physics-lab-section-head">
                    <h3>Why</h3>
                    {chipGroup(
                      "Explain",
                      () => config().limit.explain,
                      EXPLAIN_LEVELS,
                      (level) => session().setLimitExplain(level),
                      "dsm-physics-lab-limit-explain"
                    )}
                  </div>
                  {stepList(
                    () => none()?.steps ?? [],
                    () => none()?.reason ?? "",
                    () => config().limit.explain
                  )}
                </div>
              )}
            </If>
          </section>
        )}
      </If>

      {/* Offered only where it changes the answer: a function that lives on
          one side of the point. Both conventions are in textbooks, and which
          one a course uses is the reader's to say. */}
      <If
        predicate={() =>
          value()?.endpoint === true || none()?.endpoint === true
        }
      >
        {() => (
          <section class="dsm-physics-lab-section">
            {chipGroup(
              "Two-sided limit at the edge of the domain",
              () => config().limit.convention,
              CONVENTIONS,
              (convention) => session().setLimitConvention(convention),
              "dsm-physics-lab-limit-convention"
            )}
          </section>
        )}
      </If>

      {/* Nothing while half-typed, for the reason the Integral tab gives. */}
      <If predicate={() => (refused()?.error ?? "") !== ""}>
        {() => (
          <section class="dsm-physics-lab-section">
            <div
              class="dsm-physics-lab-refusal"
              data-physics-lab="limit-refusal"
            >
              {() => refused()?.error ?? ""}
            </div>
            {sideLines(refusedSides, () => config().limit.fLatex)}
            <div class="dsm-physics-lab-hint">
              Refused rather than guessed. A number the function seems to
              approach is evidence, not a limit.
            </div>
          </section>
        )}
      </If>
    </div>
  );
}

/** The one-sided limits that exist, each a line of maths. */
function sideLines(sides: () => LimitSideView[], body: () => string) {
  return (
    <For
      each={() => sides().map((side) => ({ key: side.latex, side }))}
      key={(entry: { key: string }) => entry.key}
    >
      {(entry: () => { side: LimitSideView }) =>
        limitStatement(
          "",
          () => entry().side.approachLatex,
          () => `${body()}=${entry().side.valueLatex}`
        )
      }
    </For>
  );
}

/**
 * The steps of an explanation, numbered, at the depth asked for.
 *
 * One list for every depth: what changes is which parts of each step are
 * shown, never which steps there are, so moving between the depths cannot
 * change the argument.
 */
function stepList(
  steps: () => LimitStepView[],
  route: () => string,
  level: () => ExplainLevel
) {
  return (
    <ol class="dsm-physics-lab-limit-steps" data-physics-lab="limit-steps">
      <For
        each={() =>
          steps().map((step, index) => ({
            key: `${route()} ${index}`,
            step,
          }))
        }
        key={(entry: { key: string }) => entry.key}
      >
        {(entry: () => { step: LimitStepView }) => (
          <li class="dsm-physics-lab-limit-step">
            <div class="dsm-physics-lab-limit-say">
              {() => entry().step.say}
            </div>
            <For
              each={() =>
                entry().step.lines.map((line, index) => ({
                  key: `${index} ${line.kind} ${line.equals ? "=" : ""} ${line.latex}`,
                  line,
                }))
              }
              key={(item: { key: string }) => item.key}
            >
              {(item: () => { line: LimitLineView }) =>
                item().line.kind === "limit" ? (
                  limitStatement(
                    item().line.equals ? "=" : "",
                    () => item().line.approachLatex,
                    () => item().line.latex
                  )
                ) : (
                  <div class="dsm-physics-lab-math dsm-physics-lab-limit-math">
                    <StaticMathQuillView
                      latex={() =>
                        `${item().line.equals ? "=" : ""}${item().line.latex}`
                      }
                    />
                  </div>
                )
              }
            </For>
            <If
              predicate={() => level() !== "simple" && entry().step.why !== ""}
            >
              {() => (
                <div class="dsm-physics-lab-limit-why">
                  {() => entry().step.why}
                </div>
              )}
            </If>
            <If
              predicate={() =>
                level() === "research" && entry().step.proof !== ""
              }
            >
              {() => (
                <div class="dsm-physics-lab-limit-proof">
                  {() => entry().step.proof}
                </div>
              )}
            </If>
          </li>
        )}
      </For>
    </ol>
  );
}

/** One bound of a definite integral: a small math field with its label. */
function boundInput(
  physicsLab: PhysicsLab,
  config: ConfigGetter,
  which: "lower" | "upper"
) {
  const latex = () =>
    which === "lower"
      ? config().integral.lowerLatex
      : config().integral.upperLatex;
  return (
    <div class="dsm-physics-lab-bound">
      <span class="dsm-physics-lab-label">
        {which === "lower" ? "from" : "to"}
      </span>
      <InlineMathInputViewGeneral
        containerClass={() => ({ "dsm-physics-lab-math-input": true })}
        placeholder={which === "lower" ? "0" : "\\infty"}
        ariaLabel={which === "lower" ? "the lower bound" : "the upper bound"}
        latex={latex}
        handleLatexChanged={(value: string) =>
          physicsLab.session.setIntegralBound(which, value)
        }
        hasError={() => false}
        manageFocus={mathquillFocusHelper({
          controller: physicsLab.cc,
          location: {
            type: "dsm-focus",
            plugin: "physics-lab",
            kind: which === "lower" ? "integral-lower" : "integral-upper",
          },
        })}
        controller={physicsLab.cc}
        readonly={false}
      />
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

/** A whole number as superscript digits, for a power written in running text. */
function superscript(value: number): string {
  const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(value).replace(/\d/g, (d) => digits[Number(d)]);
}
