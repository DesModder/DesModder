import VectorTools from "..";
import { Component, jsx } from "#DCGView";
import { mathquillFocusHelper } from "#globals";
import {
  Button,
  For,
  If,
  IfElse,
  InlineMathInputViewGeneral,
  SegmentedControl,
  SwitchUnion,
} from "#components";
import { format } from "#i18n";
import {
  FLOW_PARTICLE_HEAVY,
  FLOW_PARTICLE_MAXIMUM,
  FLOW_PARTICLE_MINIMUM,
  FLOW_RENDER_SCALE_MINIMUM,
  PANEL_MAX_HEIGHT,
  PANEL_MAX_WIDTH,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  PANEL_TABS,
  CURVE_LINE_WIDTH_MAXIMUM,
  CURVE_LINE_WIDTH_MINIMUM,
  TIME_SPEED_MAXIMUM,
  TIME_SPEED_MINIMUM,
  lengthInputsFor,
  type ArrowMode,
  type ColorPalette,
  type FlowLook,
  type ColorRangeMode,
  type FieldSource,
  type FlowColorMode,
  type SamplingMode,
  type VectorColorMode,
  type VectorFieldConfig,
  type VectorLengthMode,
  type ZeroVectorMode,
} from "../model";
import {
  PALETTES,
  PALETTE_GROUPS,
  PALETTE_IDS,
  paletteCSSGradient,
} from "../../../field-rendering/palettes";
import type { ComponentSlot } from "../generator";
import "./VectorToolsPanel.less";

interface Choice<T extends string> {
  value: T;
  label: string;
}

const LENGTH_MODES: readonly Choice<VectorLengthMode>[] = [
  { value: "actual", label: "Actual" },
  { value: "normalized", label: "Normalized" },
  { value: "scaled", label: "Scaled" },
  { value: "clamped", label: "Clamped" },
  { value: "compressed", label: "Compressed" },
  { value: "direction-only", label: "Direction only" },
];

const COLOR_MODES: readonly Choice<VectorColorMode>[] = [
  { value: "fixed", label: "Fixed" },
  { value: "magnitude", label: "Magnitude" },
  { value: "log-magnitude", label: "Log magnitude" },
  { value: "direction", label: "Direction" },
  { value: "x-component", label: "x component" },
  { value: "y-component", label: "y component" },
];

const ARROW_MODES: readonly Choice<ArrowMode>[] = [
  { value: "live", label: "Live (extension)" },
  { value: "desmos", label: "Desmos expressions" },
  { value: "off", label: "Off" },
];

const FLOW_LOOKS: readonly Choice<FlowLook>[] = [
  { value: "streamlines", label: "Streamlines" },
  { value: "texture", label: "Texture" },
];

const RANGE_MODES: readonly Choice<ColorRangeMode>[] = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

const ZERO_MODES: readonly Choice<ZeroVectorMode>[] = [
  { value: "hide", label: "Hide" },
  { value: "point", label: "Show as points" },
];

const FIELD_SOURCES: readonly Choice<FieldSource>[] = [
  { value: "components", label: "Components P, Q" },
  { value: "gradient", label: "Gradient of f" },
];

const SAMPLING_MODES: readonly Choice<SamplingMode>[] = [
  { value: "step", label: "Step" },
  { value: "count", label: "Count" },
];

const FLOW_COLOR_MODES: readonly Choice<FlowColorMode>[] = [
  { value: "speed", label: "Speed" },
  { value: "direction", label: "Direction" },
  { value: "fixed", label: "Fixed color" },
];

type ConfigGetter = () => VectorFieldConfig;

export class VectorToolsPanel extends Component<{
  vectorTools: () => VectorTools;
}> {
  template() {
    const vectorTools = this.props.vectorTools();
    const config: ConfigGetter = () => vectorTools.getConfig();
    const validation = () => vectorTools.validation;

    return (
      <div
        class="dcg-popover-interior dsm-vector-tools-menu"
        didMount={(element: HTMLElement) =>
          vectorTools.attachPanelElement(element)
        }
        willUnmount={() => vectorTools.detachPanelElement()}
      >
        <div class="dcg-popover-title">{format("vector-tools-name")}</div>
        {fieldChooser(vectorTools, config)}
        <div class="dsm-vector-tools-tabs">
          <SegmentedControl
            ariaGroupLabel="Vector Tools section"
            names={() => PANEL_TABS.map((tab) => tab.label)}
            selectedIndex={() =>
              PANEL_TABS.findIndex(
                (tab) => tab.id === vectorTools.getLibrary().panel.tab
              )
            }
            setSelectedIndex={(index: number) =>
              vectorTools.setPanelTab(PANEL_TABS[index].id)
            }
          />
        </div>

        <div class="dsm-vector-tools-body">
          {SwitchUnion(() => vectorTools.getLibrary().panel.tab, {
            field: () => fieldTab(vectorTools, config, validation),
            arrows: () => arrowsTab(vectorTools, config),
            color: () => colorTab(vectorTools, config),
            curve: () => curveTab(vectorTools, config),
            flow: () => flowTab(vectorTools, config),
          })}
          <If predicate={() => vectorTools.isTestLabVisible}>
            {() => testLab(vectorTools)}
          </If>
        </div>

        {footer(vectorTools, validation)}
      </div>
    );
  }
}

// ---- tabs ----------------------------------------------------------------

function fieldTab(
  vectorTools: VectorTools,
  config: ConfigGetter,
  validation: () => VectorTools["validation"]
) {
  return (
    <div>
      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-section-head">
          {textControl(
            "dsm-vector-tools-name",
            "Name",
            () => config().name,
            (value) => vectorTools.renameField(value)
          )}
          <div class="dsm-vector-tools-inline">
            <Button
              color="light-gray"
              class="dsm-vector-tools-duplicate-field"
              onTap={() => vectorTools.duplicateField()}
            >
              Duplicate
            </Button>
            {/* Deleting the last field would leave the panel with nothing to
                edit, so the button goes rather than failing when pressed. */}
            <If predicate={() => vectorTools.getLibrary().fields.length > 1}>
              {() => (
                <Button
                  color="light-gray"
                  class="dsm-vector-tools-delete-field"
                  onTap={() => vectorTools.deleteField(config().id)}
                >
                  Delete
                </Button>
              )}
            </If>
          </div>
        </div>
        {chipGroup(
          "Field from",
          () => config().source,
          FIELD_SOURCES,
          (value) => vectorTools.setSource(value),
          "dsm-vector-tools-source"
        )}
        {IfElse(() => config().source === "gradient", {
          true: () => (
            <div>
              <div class="dsm-vector-tools-math-row dsm-vector-tools-scalar-row">
                {componentInput(vectorTools, validation, "f")}
              </div>
              <div class="dsm-vector-tools-hint">
                P and Q are generated as Desmos's own partial derivatives of f,
                so the arrows are ∇f and stay exact.
              </div>
            </div>
          ),
          false: () => (
            <div class="dsm-vector-tools-math-row">
              {componentInput(vectorTools, validation, "p")}
              {componentInput(vectorTools, validation, "q")}
            </div>
          ),
        })}
        <div class="dsm-vector-tools-link-row">
          <Button
            color="light-gray"
            class="dsm-vector-tools-link-components"
            onTap={() => vectorTools.addComponentExpressions()}
          >
            {() => {
              const names = config().source === "gradient" ? "f" : "P and Q";
              return vectorTools.hasComponentExpressions
                ? `Show ${names} in the expression list`
                : `Edit ${names} in the expression list`;
            }}
          </Button>
          <div class="dsm-vector-tools-hint">
            {() => vectorTools.componentLinkStatus}
          </div>
          {/* A component that reads a slider looks exactly like one that does
              not, until the slider moves. */}
          <If predicate={() => vectorTools.fieldReferenceStatus !== ""}>
            {() => (
              <div class="dsm-vector-tools-hint">
                {() => vectorTools.fieldReferenceStatus}
              </div>
            )}
          </If>
        </div>
      </section>

      {/* Only for a field that reads the clock. A field written without `t` is
          a still picture and has nothing to play. */}
      <If predicate={() => vectorTools.fieldUsesTime}>
        {() => timeControls(vectorTools)}
      </If>

      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-section-head">
          <h3>Sampling domain</h3>
          <Button
            color="light-gray"
            class="dsm-vector-tools-match-viewport"
            onTap={() => vectorTools.matchDomainToViewport()}
          >
            Match viewport
          </Button>
        </div>
        {/* Side by side where the panel is wide enough, stacked where it is
            not. Two identical cards down the page were taking most of the tab
            to hold six numbers, and the tab did not fit at its default size. */}
        <div class="dsm-vector-tools-axes">
          {axisControls(vectorTools, "x", config)}
          {axisControls(vectorTools, "y", config)}
        </div>
        <div class="dsm-vector-tools-count">
          Estimated vectors:{" "}
          {() => validation().estimatedVectorCount.toLocaleString()}
        </div>
      </section>
    </div>
  );
}

function arrowsTab(vectorTools: VectorTools, config: ConfigGetter) {
  const length = () => config().length;
  const inputs = () => lengthInputsFor(length().mode);
  return (
    <div>
      <section class="dsm-vector-tools-section">
        {chipGroup(
          "Drawn by",
          () => vectorTools.arrowMode,
          ARROW_MODES,
          (value) => vectorTools.setArrowMode(value)
        )}
        <div class="dsm-vector-tools-note">
          {() =>
            vectorTools.arrowMode === "live"
              ? "Arrows are drawn over the graph as you change them. Generate writes the same field as Desmos expressions when you want to share it."
              : vectorTools.arrowMode === "desmos"
                ? "Arrows come from the expression list, so the graph works without this extension. Press Generate to write them."
                : "No arrows are drawn. The flow visualizer and Generate still work."
          }
        </div>
        <If predicate={() => vectorTools.arrowMode === "live"}>
          {() =>
            checkboxControl(
              "Thin very dense grids so arrows stay readable",
              () => config().arrowDensityLimit,
              (checked) => vectorTools.setArrowDensityLimit(checked)
            )
          }
        </If>
        <div class="dsm-vector-tools-status">
          {() => vectorTools.arrowStatus}
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        {chipGroup(
          "Length mode",
          () => length().mode,
          LENGTH_MODES,
          (value) => vectorTools.setLength("mode", value)
        )}
        {/* Only the numbers this mode reads. The other three would take input
            and change nothing, which reads as a broken control rather than an
            inapplicable one. */}
        <If predicate={() => inputs().targetLength}>
          {() =>
            checkboxControl(
              "Auto target length from sampling spacing",
              () => length().autoLength,
              (checked) => vectorTools.setLength("autoLength", checked)
            )
          }
        </If>
        <div class="dsm-vector-tools-number-grid">
          <If predicate={() => inputs().targetLength}>
            {() =>
              numberControl(
                "dsm-vector-tools-target-length",
                "Target length",
                () => length().targetLength,
                (value) => vectorTools.setLength("targetLength", value),
                () => length().autoLength
              )
            }
          </If>
          <If predicate={() => inputs().scale}>
            {() =>
              numberControl(
                "dsm-vector-tools-scale",
                "Scale",
                () => length().scale,
                (value) => vectorTools.setLength("scale", value)
              )
            }
          </If>
          <If predicate={() => inputs().maximumLength}>
            {() =>
              numberControl(
                "dsm-vector-tools-clamp-maximum",
                "Clamp maximum",
                () => length().maximumLength,
                (value) => vectorTools.setLength("maximumLength", value)
              )
            }
          </If>
          <If predicate={() => inputs().compression}>
            {() =>
              numberControl(
                "dsm-vector-tools-compression",
                "Compression",
                () => length().compression,
                (value) => vectorTools.setLength("compression", value)
              )
            }
          </If>
        </div>
        <If predicate={() => length().mode === "actual"}>
          {() => (
            <div class="dsm-vector-tools-hint">
              Arrows are drawn at the field's own magnitude, so there is nothing
              to set here.
            </div>
          )}
        </If>
      </section>

      <section class="dsm-vector-tools-section">
        <h3>Arrowhead</h3>
        {sliderControl(
          "dsm-vector-tools-arrowhead-size",
          "Size",
          () => config().arrowhead.size,
          { minimum: 0.02, maximum: 1, step: 0.01, decimals: 2 },
          (value) => vectorTools.setArrowhead("size", value)
        )}
        {sliderControl(
          "dsm-vector-tools-arrowhead-angle",
          "Angle (rad)",
          () => config().arrowhead.angleRadians,
          { minimum: 0.05, maximum: 1.5, step: 0.01, decimals: 2 },
          (value) => vectorTools.setArrowhead("angleRadians", value)
        )}
        {chipGroup(
          "Zero vectors",
          () => config().zeroVectorMode,
          ZERO_MODES,
          (value) => vectorTools.setZeroVectorMode(value)
        )}
      </section>
    </div>
  );
}

/**
 * Everything that decides what colour anything is, for both things that draw.
 *
 * The flow's colour controls used to live on the Flow tab, beside the settings
 * that decide how the particles move. That split the question "what colour is
 * this picture" across two tabs and left the Colour tab quietly meaning "the
 * arrows only" while never saying so. They are here together now, each under
 * the name of the thing it colours.
 *
 * They stay separately settable: colouring arrows by magnitude while the flow
 * runs a quiet single hue is a legitimate picture, and collapsing them into one
 * setting would impose a limit where an option belongs. Wanting one scheme for
 * both is the common case though, so the match is a checkbox at the top.
 *
 * It is a standing link and not a one-press copy, which the first version was
 * and which was a mistake: that button hid itself once it had nothing left to
 * do, taking with it the only way back to what the flow had been set to. This
 * one overrides rather than overwrites, so unticking it restores exactly what
 * was there.
 *
 * Each half is a disclosure. Eighteen palettes twice over is a very long tab,
 * and the flow's half is closed by default because a graph without the flow
 * running has no use for it — the same reasoning as the Flow tab's Fine tuning.
 */
function colorTab(vectorTools: VectorTools, config: ConfigGetter) {
  const color = () => config().color;
  const usesPalette = () =>
    color().mode === "magnitude" || color().mode === "log-magnitude";
  // One swatch, two users: the arrows read it in fixed mode and so does the
  // flow, so it stays while either of them still needs it. Which mode the flow
  // is *actually* in depends on the match, so this asks for the effective one.
  const flowUsesFixed = () => vectorTools.flowColor.colorMode === "fixed";
  const arrowsUseFixed = () => color().mode === "fixed";
  const usesFixed = () => arrowsUseFixed() || flowUsesFixed();
  const fixedUsers = () => {
    if (arrowsUseFixed() && flowUsesFixed())
      return "The arrows and the flow's particles are both set to this color.";
    if (flowUsesFixed()) return "The flow's particles are set to this color.";
    return "The arrows are set to this color.";
  };
  return (
    <div>
      {checkboxControl(
        "Use the same colors for the flow as for the arrows",
        () => vectorTools.matchFlowColor,
        (checked) => vectorTools.setMatchFlowColor(checked),
        "dsm-vector-tools-match-colors"
      )}
      {checkboxControl(
        "Keep these colors when the graph is in reverse contrast",
        () => vectorTools.keepColorsInReverseContrast,
        (checked) => vectorTools.setKeepColorsInReverseContrast(checked),
        "dsm-vector-tools-keep-colors"
      )}
      {/* Reverse contrast is `filter: invert(1)` on an ancestor of both overlay
          canvases, so the field inverts with the page unless it is inverted a
          second time. Says which of the two situations it is in, because a
          checkbox that does nothing right now is worth explaining rather than
          hiding — the graph setting it depends on lives somewhere else. */}
      <div class="dsm-vector-tools-hint">
        {() =>
          vectorTools.graphReversesContrast
            ? vectorTools.keepColorsInReverseContrast
              ? "The graph is reversed and the field is keeping its own colors."
              : "The graph is reversed, so the field is reversed with it."
            : "Only applies while Desmos's reverse contrast is on. Ticked, a dark graph keeps a bright field."
        }
      </div>

      <details class="dsm-vector-tools-more" open>
        <summary>Arrows</summary>
        {chipGroup(
          "Color mode",
          () => color().mode,
          COLOR_MODES,
          (value) => vectorTools.setColor("mode", value)
        )}
        <If predicate={usesPalette}>
          {() => (
            <div>
              {paletteChooser(
                "Palette",
                () => color().palette,
                (value) => vectorTools.setColor("palette", value)
              )}
              {chipGroup(
                "Color range",
                () => color().rangeMode,
                RANGE_MODES,
                (value) => vectorTools.setColor("rangeMode", value)
              )}
              <If predicate={() => color().rangeMode === "manual"}>
                {() => (
                  <div class="dsm-vector-tools-number-grid">
                    {numberControl(
                      "dsm-vector-tools-range-minimum",
                      "Range minimum",
                      () => color().minimum,
                      (value) => vectorTools.setColor("minimum", value)
                    )}
                    {numberControl(
                      "dsm-vector-tools-range-maximum",
                      "Range maximum",
                      () => color().maximum,
                      (value) => vectorTools.setColor("maximum", value)
                    )}
                  </div>
                )}
              </If>
            </div>
          )}
        </If>
      </details>

      <details class="dsm-vector-tools-more dsm-vector-tools-flow-colors">
        <summary>Flow particles</summary>
        {IfElse(() => vectorTools.matchFlowColor, {
          // Its own controls are not shown while the link is on, because they
          // would be describing a picture nobody is looking at. They are not
          // gone — unticking the box above brings them back as they were.
          true: () => (
            <div class="dsm-vector-tools-hint">
              Following the arrows. Untick the box above to set these
              separately; whatever was chosen before is still here.
            </div>
          ),
          false: () => (
            <div>
              {chipGroup(
                "Particle color",
                () => config().flow.colorMode,
                FLOW_COLOR_MODES,
                (value) => vectorTools.setFlow("colorMode", value)
              )}
              {/* Direction runs along a cyclic ramp of its own and fixed takes
                  the shared swatch, so only speed has a ramp to choose. */}
              <If predicate={() => config().flow.colorMode === "speed"}>
                {() =>
                  paletteChooser(
                    "Particle palette",
                    () => config().flow.palette,
                    (value) => vectorTools.setFlow("palette", value)
                  )
                }
              </If>
            </div>
          ),
        })}
      </details>

      <If predicate={usesFixed}>
        {() => (
          <section class="dsm-vector-tools-section">
            <label
              class="dsm-vector-tools-label"
              for="dsm-vector-tools-fixed-color"
            >
              Fixed color
            </label>
            <input
              id="dsm-vector-tools-fixed-color"
              type="color"
              onUpdate={(element: HTMLInputElement) => {
                if (document.activeElement !== element)
                  element.value = color().fixedColor;
              }}
              onInput={(event: Event) =>
                vectorTools.setColor(
                  "fixedColor",
                  (event.target as HTMLInputElement).value
                )
              }
            />
            <div class="dsm-vector-tools-hint">{fixedUsers}</div>
          </section>
        )}
      </If>
    </div>
  );
}

/**
 * A parametrized curve over the field.
 *
 * Its own tab rather than a section of Field, because a curve is not the field:
 * it has its own definition, its own parameter range, and its own colour, and
 * filing it under the thing it is drawn on top of would suggest otherwise.
 *
 * There is no live preview, and that is the point rather than an omission —
 * Desmos draws parametrics natively and better than a line-strip pipeline of
 * ours would, and a generated curve is still there for someone without the
 * extension. It appears on Generate, with the rest of the field.
 */
function curveTab(vectorTools: VectorTools, config: ConfigGetter) {
  const curve = () => config().curve;
  return (
    <div>
      <section class="dsm-vector-tools-section">
        {checkboxControl(
          "Draw a parametric curve over the field",
          () => curve().enabled,
          (checked) => vectorTools.setCurve("enabled", checked),
          "dsm-vector-tools-curve-enabled"
        )}
        <div class="dsm-vector-tools-hint">
          Written into the graph as one Desmos parametric, so it survives
          without the extension. `t` here is the curve's own parameter.
        </div>
      </section>

      <If predicate={() => curve().enabled}>
        {() => (
          <div>
            <section class="dsm-vector-tools-section">
              <div class="dsm-vector-tools-math-row">
                {curveInput(vectorTools, "X(t)", "x")}
                {curveInput(vectorTools, "Y(t)", "y")}
              </div>
              <div class="dsm-vector-tools-number-grid">
                {numberControl(
                  "dsm-vector-tools-curve-t-min",
                  "t minimum",
                  () => curve().tMin,
                  (value) => vectorTools.setCurve("tMin", value)
                )}
                {numberControl(
                  "dsm-vector-tools-curve-t-max",
                  "t maximum",
                  () => curve().tMax,
                  (value) => vectorTools.setCurve("tMax", value)
                )}
              </div>
            </section>

            <section class="dsm-vector-tools-section">
              <label
                class="dsm-vector-tools-label"
                for="dsm-vector-tools-curve-color"
              >
                Curve color
              </label>
              <input
                id="dsm-vector-tools-curve-color"
                type="color"
                onUpdate={(element: HTMLInputElement) => {
                  if (document.activeElement !== element)
                    element.value = curve().color;
                }}
                onInput={(event: Event) =>
                  vectorTools.setCurve(
                    "color",
                    (event.target as HTMLInputElement).value
                  )
                }
              />
              {sliderControl(
                "dsm-vector-tools-curve-width",
                "Line width",
                () => curve().lineWidth,
                {
                  minimum: CURVE_LINE_WIDTH_MINIMUM,
                  maximum: CURVE_LINE_WIDTH_MAXIMUM,
                  step: 0.5,
                  decimals: 1,
                },
                (value) => vectorTools.setCurve("lineWidth", value)
              )}
              {checkboxControl(
                "Show a point travelling along it",
                () => curve().showPoint,
                (checked) => vectorTools.setCurve("showPoint", checked),
                "dsm-vector-tools-curve-point"
              )}
              {/* The dot reads the same X and Y at the clock rather than
                  keeping a second copy of the curve, so it cannot drift off it.
                  Asking for one is also what gives a static field a clock. */}
              <div class="dsm-vector-tools-hint">
                The point sits at the curve's position at the current time, and
                gives the graph a clock even when the field itself is static.
              </div>
            </section>
          </div>
        )}
      </If>
    </div>
  );
}

function curveInput(vectorTools: VectorTools, label: string, axis: "x" | "y") {
  const key = axis === "x" ? "xLatex" : "yLatex";
  return (
    <div>
      <label class="dsm-vector-tools-label">{label}</label>
      <InlineMathInputViewGeneral
        containerClass={() => ({ "dsm-vector-tools-math-input": true })}
        placeholder={axis === "x" ? "\\cos(t)" : "\\sin(t)"}
        ariaLabel={`${label} of the curve`}
        latex={() => vectorTools.getConfig().curve[key]}
        handleLatexChanged={(latex: string) => vectorTools.setCurve(key, latex)}
        hasError={() => false}
        manageFocus={mathquillFocusHelper({
          controller: vectorTools.cc,
          location: {
            type: "dsm-focus",
            plugin: "vector-tools",
            kind: `curve-${axis}`,
          },
        })}
        controller={vectorTools.cc}
        readonly={false}
      />
    </div>
  );
}

function flowTab(vectorTools: VectorTools, config: ConfigGetter) {
  const flow = () => config().flow;
  const compilation = () => vectorTools.flowAvailability;
  return (
    <div>
      <section class="dsm-vector-tools-section dsm-vector-tools-flow">
        <p class="dsm-vector-tools-hint">
          Animates particles carried by the field, drawn over the graph paper.
          It reads the same P and Q, and adds no expressions.
        </p>
        <div class="dsm-vector-tools-actions">
          <Button
            color={() => (vectorTools.isFlowRunning ? "light-gray" : "blue")}
            class="dsm-vector-tools-visualize"
            disabled={() => !compilation().ok}
            onTap={() => vectorTools.toggleFlow()}
          >
            {() =>
              vectorTools.isFlowRunning ? "Stop visualization" : "Visualize"
            }
          </Button>
        </div>
        <If predicate={() => !compilation().ok}>
          {() => (
            <div class="dsm-vector-tools-warning">
              {() => {
                const result = compilation();
                return result.ok ? "" : result.error;
              }}
            </div>
          )}
        </If>
        <div class="dsm-vector-tools-status dsm-vector-tools-flow-status">
          {() => vectorTools.flowStatus}
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        {particleCountControl(vectorTools, flow)}
        {chipGroup(
          "Look",
          () => vectorTools.flowLook,
          FLOW_LOOKS,
          (value) => vectorTools.setFlowLook(value)
        )}
        {sliderControl(
          "dsm-vector-tools-flow-speed",
          "Speed",
          () => flow().speed,
          { minimum: 0.05, maximum: 8, step: 0.05, decimals: 2 },
          (value) => vectorTools.setFlow("speed", value)
        )}
        {checkboxControl(
          "Constant speed (follow streamlines evenly)",
          () => flow().normalizeSpeed,
          (checked) => vectorTools.setFlow("normalizeSpeed", checked)
        )}
        {/* The particles' colour is set on the Color tab, beside the arrows',
            so that what colour the picture is has one place to be answered. */}
        <div class="dsm-vector-tools-hint">
          Particle color is on the Color tab, with the arrows'.
        </div>
      </section>

      {/* Everything below is a refinement of what Look already set, or a
          trade of detail for frame rate. Folded away so the controls that
          change what the flow *is* are the ones on screen. */}
      <details class="dsm-vector-tools-more">
        <summary>Fine tuning</summary>
        <div class="dsm-vector-tools-hint">
          Look sets the trail and respawn rates; changing them here keeps
          whatever you choose.
        </div>
        {sliderControl(
          "dsm-vector-tools-flow-trail",
          "Trail length",
          () => flow().trailPersistence,
          { minimum: 0, maximum: 0.995, step: 0.005, decimals: 3 },
          (value) => vectorTools.setFlow("trailPersistence", value)
        )}
        {sliderControl(
          "dsm-vector-tools-flow-drop-rate",
          "Respawn rate",
          () => flow().dropRate,
          { minimum: 0, maximum: 0.2, step: 0.001, decimals: 3 },
          (value) => vectorTools.setFlow("dropRate", value)
        )}
        {sliderControl(
          "dsm-vector-tools-flow-opacity",
          "Opacity",
          () => flow().opacity,
          { minimum: 0.05, maximum: 1, step: 0.01, decimals: 2 },
          (value) => vectorTools.setFlow("opacity", value)
        )}
        {sliderControl(
          "dsm-vector-tools-flow-point-size",
          "Particle size",
          () => flow().pointSize,
          { minimum: 0.5, maximum: 6, step: 0.1, decimals: 1 },
          (value) => vectorTools.setFlow("pointSize", value)
        )}
        {sliderControl(
          "dsm-vector-tools-flow-render-scale",
          "Render detail (lower is faster)",
          () => flow().renderScale,
          {
            minimum: FLOW_RENDER_SCALE_MINIMUM,
            maximum: 1,
            step: 0.05,
            decimals: 2,
          },
          (value) => vectorTools.setFlow("renderScale", value)
        )}
      </details>
    </div>
  );
}

function footer(
  vectorTools: VectorTools,
  validation: () => VectorTools["validation"]
) {
  return (
    <div class="dsm-vector-tools-footer dsm-vector-tools-validation">
      {IfElse(() => validation().issues.length === 0, {
        true: () => (
          <div class="dsm-vector-tools-valid">Ready to generate.</div>
        ),
        false: () => (
          <div class="dsm-vector-tools-issues">
            <For
              each={() =>
                validation().issues.map((issue, index) => ({ ...issue, index }))
              }
              key={(issue: { index: number }) => issue.index}
            >
              {(getIssue: () => { level: string; message: string }) => (
                <div class={() => `dsm-vector-tools-${getIssue().level}`}>
                  {() => getIssue().message}
                </div>
              )}
            </For>
          </div>
        ),
      })}
      <div class="dsm-vector-tools-actions">
        <Button
          color="blue"
          class="dsm-vector-tools-generate"
          disabled={() => !validation().canGenerate}
          onTap={() => vectorTools.generateProduction()}
        >
          Generate field
        </Button>
        <Button
          color="light-gray"
          class="dsm-vector-tools-remove"
          onTap={() => vectorTools.removeProductionField()}
        >
          Remove
        </Button>
        <Button
          color="light-gray"
          class="dsm-vector-tools-reset"
          onTap={() => vectorTools.resetConfig()}
        >
          Reset
        </Button>
      </div>
      {confirmationControls(vectorTools)}
      <div class="dsm-vector-tools-status">{() => vectorTools.message}</div>
    </div>
  );
}

// ---- pieces --------------------------------------------------------------

const SLOT_LABELS: Record<ComponentSlot, string> = {
  p: "P(x, y)",
  q: "Q(x, y)",
  f: "f(x, y)",
};

const SLOT_PLACEHOLDERS: Record<ComponentSlot, string> = {
  p: "-y",
  q: "x",
  f: "x^2+y^2",
};

/** The name validation issues use for a slot, which has no spaces in it. */
const SLOT_ISSUE_NAMES: Record<ComponentSlot, string> = {
  p: "P(x,y)",
  q: "Q(x,y)",
  f: "f(x,y)",
};

function componentInput(
  vectorTools: VectorTools,
  validation: () => VectorTools["validation"],
  which: ComponentSlot
) {
  return (
    <div>
      <label class="dsm-vector-tools-label">{SLOT_LABELS[which]}</label>
      <InlineMathInputViewGeneral
        containerClass={() => ({ "dsm-vector-tools-math-input": true })}
        placeholder={SLOT_PLACEHOLDERS[which]}
        ariaLabel={`${which === "f" ? "f" : which.toUpperCase()} of x and y`}
        latex={() => vectorTools.slotLatex(which)}
        handleLatexChanged={(latex) => vectorTools.setSlot(which, latex)}
        hasError={() => hasIssue(validation().issues, SLOT_ISSUE_NAMES[which])}
        manageFocus={mathquillFocusHelper({
          controller: vectorTools.cc,
          location: {
            type: "dsm-focus",
            plugin: "vector-tools",
            kind: which,
          },
        })}
        controller={vectorTools.cc}
        readonly={false}
      />
    </div>
  );
}

/**
 * Play, speed and reset for a field written in terms of `t`.
 *
 * Deliberately not a scrubber. `t` is unbounded — a field may be interesting at
 * t=0.4 and at t=400 — so there is no range for a slider to span, and inventing
 * one would be choosing a story for the field on the user's behalf. Speed and a
 * reset are the two controls that work whatever the field does with the number.
 */
function timeControls(vectorTools: VectorTools) {
  return (
    <section class="dsm-vector-tools-section dsm-vector-tools-time">
      <div class="dsm-vector-tools-section-head">
        <h3>Time</h3>
        <Button
          color="light-gray"
          class="dsm-vector-tools-time-reset"
          onTap={() => vectorTools.resetClock()}
        >
          Reset to 0
        </Button>
      </div>
      <div class="dsm-vector-tools-actions">
        <Button
          color="light-gray"
          class="dsm-vector-tools-time-play"
          onTap={() =>
            vectorTools.setTimePlaying(!vectorTools.timeConfig.playing)
          }
        >
          {() => (vectorTools.timeConfig.playing ? "Pause" : "Play")}
        </Button>
      </div>
      {sliderControl(
        "dsm-vector-tools-time-speed",
        "Speed",
        () => vectorTools.timeConfig.speed,
        {
          minimum: TIME_SPEED_MINIMUM,
          maximum: TIME_SPEED_MAXIMUM,
          step: 0.05,
          decimals: 2,
        },
        (value) => vectorTools.setTimeSpeed(value)
      )}
      <div class="dsm-vector-tools-hint">
        The arrows and the flow read one clock, so both show the same instant.
      </div>
    </section>
  );
}

/**
 * The saved fields, above the tabs rather than inside one.
 *
 * Every tab edits the field this row points at — Colour and Flow as much as
 * Field — so a chooser buried in one of them would look like a setting of that
 * tab. It also has to stay small: it sits in the panel's chrome, where the space
 * it takes is taken from every tab at once.
 *
 * Chips rather than a dropdown, for the same reason every other choice in this
 * panel is chips: DCGView cannot drive a native `select`'s selection through
 * props, and a dropdown inside a scrolling popover is awkward to hit.
 */
function fieldChooser(vectorTools: VectorTools, config: ConfigGetter) {
  const fields = () => vectorTools.getLibrary().fields;
  return (
    <div
      class="dsm-vector-tools-chooser"
      role="group"
      aria-label="Saved fields"
    >
      <div class="dsm-vector-tools-field-chips">
        <For each={fields} key={(field: VectorFieldConfig) => field.id}>
          {(getField: () => VectorFieldConfig) => (
            <span
              role="button"
              tabIndex={0}
              data-field={() => getField().id}
              class={() => ({
                "dsm-vector-tools-chip": true,
                "dsm-vector-tools-chip-selected": getField().id === config().id,
              })}
              aria-pressed={() =>
                getField().id === config().id ? "true" : "false"
              }
              onTap={() => vectorTools.setActiveField(getField().id)}
            >
              {() => getField().name}
            </span>
          )}
        </For>
      </div>
      <span
        role="button"
        tabIndex={0}
        class="dsm-vector-tools-chip dsm-vector-tools-add-field"
        aria-label="New field"
        onTap={() => vectorTools.addField()}
      >
        +
      </span>
    </div>
  );
}

function axisControls(
  vectorTools: VectorTools,
  axisName: "x" | "y",
  config: ConfigGetter
) {
  const axis = () => config().domain[axisName];
  return (
    <div class="dsm-vector-tools-axis" data-axis={axisName}>
      {/* The heading and the mode share a line, and the numbers share the one
          below. The mode stays per-axis — sampling x by step and y by count is
          unusual and entirely reasonable — it just no longer costs a row. */}
      <div class="dsm-vector-tools-axis-head">
        <div class="dsm-vector-tools-axis-heading">{axisName} axis</div>
        {chipGroup(
          "",
          () => axis().mode,
          SAMPLING_MODES,
          (value) => vectorTools.setAxis(axisName, "mode", value),
          `dsm-vector-tools-${axisName}-sampling`,
          `Sampling ${axisName} by`
        )}
      </div>
      <div class="dsm-vector-tools-number-grid dsm-vector-tools-axis-numbers">
        {numberControl(
          `dsm-vector-tools-${axisName}-minimum`,
          "Minimum",
          () => axis().min,
          (value) => vectorTools.setAxis(axisName, "min", value)
        )}
        {numberControl(
          `dsm-vector-tools-${axisName}-maximum`,
          "Maximum",
          () => axis().max,
          (value) => vectorTools.setAxis(axisName, "max", value)
        )}
      </div>
      {IfElse(() => axis().mode === "step", {
        true: () =>
          numberControl(
            `dsm-vector-tools-${axisName}-step`,
            "Step",
            () => axis().step,
            (value) => vectorTools.setAxis(axisName, "step", value)
          ),
        false: () =>
          numberControl(
            `dsm-vector-tools-${axisName}-count`,
            "Count",
            () => axis().count,
            (value) => vectorTools.setAxis(axisName, "count", Math.round(value))
          ),
      })}
    </div>
  );
}

function particleCountControl(
  vectorTools: VectorTools,
  flow: () => VectorFieldConfig["flow"]
) {
  const set = (value: number) =>
    vectorTools.setFlow(
      "particleCount",
      Math.round(
        Math.min(FLOW_PARTICLE_MAXIMUM, Math.max(FLOW_PARTICLE_MINIMUM, value))
      )
    );
  return (
    <div class="dsm-vector-tools-particles">
      <div class="dsm-vector-tools-slider-head">
        <label class="dsm-vector-tools-label" for="dsm-vector-tools-particles">
          Particles
        </label>
        <input
          id="dsm-vector-tools-particle-count"
          class="dsm-vector-tools-particle-count"
          type="number"
          min={FLOW_PARTICLE_MINIMUM}
          max={FLOW_PARTICLE_MAXIMUM}
          step="500"
          onUpdate={(element: HTMLInputElement) => {
            if (document.activeElement !== element)
              element.value = String(flow().particleCount);
          }}
          onChange={(event: Event) => commitNumber(event, set)}
        />
      </div>
      {/*
        The slider is exponential: the interesting range is 500-40,000, and a
        linear slider would bury all of it in the first tenth of the track.
      */}
      <input
        id="dsm-vector-tools-particles"
        class="dsm-vector-tools-slider"
        type="range"
        min="0"
        max="1000"
        step="1"
        onUpdate={(element: HTMLInputElement) => {
          if (document.activeElement !== element)
            element.value = String(countToSlider(flow().particleCount));
        }}
        onInput={(event: Event) =>
          set(sliderToCount(Number((event.target as HTMLInputElement).value)))
        }
      />
      <If predicate={() => flow().particleCount > FLOW_PARTICLE_HEAVY}>
        {() => (
          <div class="dsm-vector-tools-warning">
            Above {FLOW_PARTICLE_HEAVY.toLocaleString()} particles the animation
            may drop frames on an integrated GPU.
          </div>
        )}
      </If>
    </div>
  );
}

function countToSlider(count: number) {
  const t =
    (Math.log(count) - Math.log(FLOW_PARTICLE_MINIMUM)) /
    (Math.log(FLOW_PARTICLE_MAXIMUM) - Math.log(FLOW_PARTICLE_MINIMUM));
  return Math.round(1000 * Math.min(1, Math.max(0, t)));
}

function sliderToCount(position: number) {
  const t = Math.min(1, Math.max(0, position / 1000));
  const value = Math.exp(
    Math.log(FLOW_PARTICLE_MINIMUM) +
      t * (Math.log(FLOW_PARTICLE_MAXIMUM) - Math.log(FLOW_PARTICLE_MINIMUM))
  );
  // Round to something a person would type.
  const magnitude = Math.pow(
    10,
    Math.max(2, Math.floor(Math.log10(value)) - 1)
  );
  return Math.round(value / magnitude) * magnitude;
}

interface SliderRange {
  minimum: number;
  maximum: number;
  step: number;
  decimals: number;
}

/**
 * A slider paired with its exact value. The slider is for feel and the number
 * is for precision; both write the same setting.
 */
function sliderControl(
  id: string,
  label: string,
  value: () => number,
  range: SliderRange,
  onChange: (value: number) => void
) {
  const clamp = (raw: number) =>
    Math.min(range.maximum, Math.max(range.minimum, raw));
  return (
    <div class="dsm-vector-tools-slider-row">
      <div class="dsm-vector-tools-slider-head">
        <label class="dsm-vector-tools-label" for={id}>
          {label}
        </label>
        <span class="dsm-vector-tools-slider-value">
          {() => value().toFixed(range.decimals)}
        </span>
      </div>
      <input
        id={id}
        class="dsm-vector-tools-slider"
        type="range"
        min={range.minimum}
        max={range.maximum}
        step={range.step}
        onUpdate={(element: HTMLInputElement) => {
          if (document.activeElement !== element)
            element.value = String(value());
        }}
        onInput={(event: Event) =>
          onChange(clamp(Number((event.target as HTMLInputElement).value)))
        }
      />
    </div>
  );
}

/**
 * A wrapping row of one-click options. This replaces the `<select>` elements
 * the panel used to use: a native dropdown inside a scrolling popover is
 * awkward to hit, and DCGView cannot drive its selection through props anyway.
 */
function chipGroup<T extends string>(
  label: string,
  value: () => T,
  choices: readonly Choice<T>[],
  onChange: (value: T) => void,
  id?: string,
  // A group whose visible label would only repeat the heading beside it still
  // needs one for a screen reader, and two groups sharing a label are two
  // groups nothing can tell apart.
  ariaLabel = label
) {
  return (
    <div
      class="dsm-vector-tools-chips"
      id={id}
      role="group"
      aria-label={ariaLabel}
    >
      <div class="dsm-vector-tools-label">{label}</div>
      <div class="dsm-vector-tools-chip-row">
        {choices.map((choice) => (
          <span
            role="button"
            tabIndex={0}
            data-value={choice.value}
            class={() => ({
              "dsm-vector-tools-chip": true,
              "dsm-vector-tools-chip-selected": value() === choice.value,
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
 * The palette picker, which shows each ramp rather than naming it.
 *
 * A name is a poor handle for a colour ramp — "Cividis" and "Parula" tell you
 * nothing you can act on — and there are now enough of them that reading a row
 * of names is slower than looking at a row of gradients. The swatch is built
 * from the same stops the field is drawn from, so it cannot describe a ramp
 * that is not the one it selects.
 *
 * They are grouped because the four groups are the question actually being
 * answered: the conventional ramp, one that separates a sign, one that wraps
 * without a seam, or one chosen because of how it looks.
 */
function paletteChooser(
  label: string,
  value: () => ColorPalette,
  onChange: (value: ColorPalette) => void,
  id?: string
) {
  return (
    <div
      class="dsm-vector-tools-palettes"
      id={id}
      role="group"
      aria-label={label}
    >
      <div class="dsm-vector-tools-label">{label}</div>
      {PALETTE_GROUPS.map((group) => (
        <div class="dsm-vector-tools-palette-group">
          <div class="dsm-vector-tools-palette-group-label">{group.label}</div>
          <div class="dsm-vector-tools-palette-grid">
            {PALETTE_IDS.filter((pid) => PALETTES[pid].group === group.id).map(
              (pid) => (
                <span
                  role="button"
                  tabIndex={0}
                  data-value={pid}
                  class={() => ({
                    "dsm-vector-tools-chip": true,
                    "dsm-vector-tools-palette": true,
                    "dsm-vector-tools-chip-selected": value() === pid,
                  })}
                  aria-pressed={() => (value() === pid ? "true" : "false")}
                  onTap={() => onChange(pid)}
                >
                  <span
                    class="dsm-vector-tools-palette-swatch"
                    style={{ background: paletteCSSGradient(pid) }}
                  />
                  <span class="dsm-vector-tools-palette-name">
                    {PALETTES[pid].name}
                  </span>
                </span>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * `disabled` is deliberately never passed as a prop: DCGView writes props as
 * attributes, and `disabled="false"` is still a disabled input in HTML. Setting
 * the property in `onUpdate` is the only spelling that actually toggles.
 */
function numberControl(
  id: string,
  label: string,
  value: () => number,
  onChange: (value: number) => void,
  disabled: () => boolean = () => false
) {
  return (
    <label class="dsm-vector-tools-number" for={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        step="any"
        onUpdate={(element: HTMLInputElement) => {
          element.disabled = disabled();
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

function textControl(
  id: string,
  label: string,
  value: () => string,
  onChange: (value: string) => void
) {
  return (
    <div class="dsm-vector-tools-control">
      <label class="dsm-vector-tools-label" for={id}>
        {label}
      </label>
      <input
        id={id}
        class="dsm-vector-tools-text-input"
        onUpdate={(element: HTMLInputElement) => {
          if (document.activeElement !== element) element.value = value();
        }}
        onInput={(event: Event) =>
          onChange((event.target as HTMLInputElement).value)
        }
      />
    </div>
  );
}

function checkboxControl(
  label: string,
  checked: () => boolean,
  onChange: (checked: boolean) => void,
  className?: string
) {
  return (
    <label
      class={() => ({
        "dsm-vector-tools-checkbox": true,
        ...(className === undefined ? {} : { [className]: true }),
      })}
    >
      <input
        type="checkbox"
        onUpdate={(element: HTMLInputElement) => {
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

function confirmationControls(vectorTools: VectorTools) {
  return (
    <If predicate={() => vectorTools.needsGenerationConfirmation}>
      {() => (
        <div class="dsm-vector-tools-confirmation">
          <span>High-density field:</span>
          <Button
            color="red"
            onTap={() => vectorTools.confirmPendingGeneration()}
          >
            Generate anyway
          </Button>
          <Button
            color="light-gray"
            onTap={() => vectorTools.cancelPendingGeneration()}
          >
            Cancel
          </Button>
        </div>
      )}
    </If>
  );
}

function testLab(vectorTools: VectorTools) {
  return (
    <details class="dsm-vector-tools-test-lab">
      <summary>Developer Test Lab</summary>
      <p class="dsm-vector-tools-hint">
        Development-build only. Test expressions use their own namespace and are
        not stored as production settings.
      </p>
      {chipGroup(
        "Preset field",
        () => vectorTools.selectedTestPreset.id,
        vectorTools.testPresets.map((preset) => ({
          value: preset.id,
          label: preset.name,
        })),
        (value) => vectorTools.setTestPreset(value),
        "dsm-vector-tools-test-preset"
      )}
      {chipGroup(
        "Density",
        () => vectorTools.selectedDensityPreset.id,
        vectorTools.densityPresets.map((density) => ({
          value: density.id,
          label: `${density.name} (${density.xCount}×${density.yCount})`,
        })),
        (value) => vectorTools.setTestDensity(value),
        "dsm-vector-tools-test-density"
      )}
      {chipGroup(
        "Length mode",
        () => vectorTools.currentTestLengthMode,
        LENGTH_MODES,
        (value) => vectorTools.setTestLengthMode(value),
        "dsm-vector-tools-test-length"
      )}
      {chipGroup(
        "Color mode",
        () => vectorTools.currentTestColorMode,
        COLOR_MODES,
        (value) => vectorTools.setTestColorMode(value),
        "dsm-vector-tools-test-color"
      )}
      <div class="dsm-vector-tools-actions">
        <Button color="blue" onTap={() => vectorTools.generateTestField()}>
          Run Test
        </Button>
        <Button color="light-gray" onTap={() => vectorTools.removeTestField()}>
          Remove Test
        </Button>
        <Button
          color="light-gray"
          onTap={() => {
            vectorTools.copyDiagnostics().then(
              () => undefined,
              () => undefined
            );
          }}
        >
          Copy diagnostics
        </Button>
      </div>
      {confirmationControls(vectorTools)}
      <div class="dsm-vector-tools-probes">
        <strong>Manual probes</strong>
        <For
          each={() =>
            vectorTools.selectedTestPreset.probes.map((probe, index) => ({
              probe,
              index,
            }))
          }
          key={(entry: { index: number }) => entry.index}
        >
          {(
            getEntry: () => {
              probe: { point: readonly number[]; expected: readonly number[] };
            }
          ) => (
            <div>
              {() => {
                const { point, expected } = getEntry().probe;
                return `(${point[0]}, ${point[1]}) → (${expected[0]}, ${expected[1]})`;
              }}
            </div>
          )}
        </For>
      </div>
      <div class="dsm-vector-tools-checklist">
        <strong>Manual QA checklist</strong>
        <For
          each={() => vectorTools.checklist}
          key={(item: { id: string }) => item.id}
        >
          {(getItem: () => { id: string; label: string; complete: boolean }) =>
            checkboxControl(
              getItem().label,
              () => getItem().complete,
              (checked) =>
                vectorTools.toggleChecklist(getItem().id as never, checked)
            )
          }
        </For>
      </div>
      {auditTable(vectorTools)}
    </details>
  );
}

function auditTable(vectorTools: VectorTools) {
  const audit = () => vectorTools.testAudit;
  return (
    <div class="dsm-vector-tools-audit">
      <strong>Expression audit</strong>
      <div class="dsm-vector-tools-audit-summary">
        {() => {
          const report = audit();
          if (
            report.folderMissing ||
            report.renderMissing ||
            report.namespaceCollision
          )
            return "Attention required";
          if (report.colorLatexMissing.length > 0)
            return "Mapped colors were dropped by the calculator";
          return "Structure looks correct";
        }}
      </div>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <For each={() => audit().rows} key={(row: { id: string }) => row.id}>
            {(
              getRow: () => {
                purpose: string;
                present: boolean;
                visibility: string;
              }
            ) => (
              <tr>
                <td>{() => getRow().purpose}</td>
                <td>
                  {() => (getRow().present ? getRow().visibility : "missing")}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

function hasIssue(issues: readonly { message: string }[], startsWith: string) {
  return issues.some((issue) => issue.message.startsWith(startsWith));
}

export const PANEL_SIZE_LIMITS = {
  minWidth: PANEL_MIN_WIDTH,
  maxWidth: PANEL_MAX_WIDTH,
  minHeight: PANEL_MIN_HEIGHT,
  maxHeight: PANEL_MAX_HEIGHT,
};

export function VectorToolsPanelFunc(vectorTools: VectorTools) {
  return <VectorToolsPanel vectorTools={() => vectorTools} />;
}
