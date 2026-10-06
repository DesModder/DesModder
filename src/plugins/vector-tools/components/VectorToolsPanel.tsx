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
  StaticMathQuillView,
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
  FLUID_CELLS_MAXIMUM,
  FLUID_CELLS_MINIMUM,
  FLUID_REYNOLDS_MAXIMUM,
  FLUID_REYNOLDS_MINIMUM,
  TIME_SPEED_MAXIMUM,
  TIME_SPEED_MINIMUM,
  fluidLatticeSize,
  lengthInputsFor,
  type FluidGuardMode,
  type FluidMode,
  type FluidShow,
  type FluidPrecision,
  type FluidSpeedMode,
  type ArrowMode,
  type ColorPalette,
  type FlowLook,
  type ColorRangeMode,
  type FieldSource,
  type FlowColorMode,
  type OverlayLayer,
  type SamplingMode,
  type VectorColorMode,
  type VectorFieldConfig,
  type VectorLengthMode,
  type ZeroVectorMode,
} from "../model";
import {
  COLOR_CONTRAST_MAXIMUM,
  COLOR_CONTRAST_MINIMUM,
  COLOR_SATURATION_MAXIMUM,
  COLOR_SATURATION_MINIMUM,
  NO_COLOR_ADJUST,
  PALETTES,
  PALETTE_GROUPS,
  PALETTE_IDS,
  paletteCSSGradient,
  type ColorAdjust,
} from "../../../field-rendering/palettes";
import {
  CLOSURE_REYNOLDS,
  MEASUREMENT_CELLS,
  SMAGORINSKY_C,
  type LatticeUnits,
} from "../../../field-rendering/sim/latticeUnits";
import {
  CellKind,
  type FluidSession,
  type ObstacleRow,
} from "../fluid/FluidSession";
import type { ComponentSlot } from "../generator";
import type { GalleryPreset } from "../gallery";
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

const OVERLAY_LAYERS: readonly Choice<OverlayLayer>[] = [
  { value: "under", label: "Under the graph" },
  { value: "over", label: "Over the graph" },
];

/** Shared by the arrows' pair and the flow's, which mean the same two things. */
const SATURATION_RANGE: SliderRange = {
  minimum: COLOR_SATURATION_MINIMUM,
  maximum: COLOR_SATURATION_MAXIMUM,
  step: 0.05,
  decimals: 2,
};
const CONTRAST_RANGE: SliderRange = {
  minimum: COLOR_CONTRAST_MINIMUM,
  maximum: COLOR_CONTRAST_MAXIMUM,
  step: 0.05,
  decimals: 2,
};

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
            fluid: () => fluidTab(vectorTools, config),
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
      {gallerySection(vectorTools)}
      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-section-head">
          {textControl(
            "dsm-vector-tools-name",
            "Name",
            () => config().name,
            (value) => vectorTools.renameField(value)
          )}
          <div class="dsm-vector-tools-inline">
            {/* Everything is saved as it changes, so this is a checkpoint
                rather than a commit — and unlike Duplicate it leaves you on
                the field you are working on. */}
            <Button
              color="blue"
              class="dsm-vector-tools-save-field"
              onTap={() => vectorTools.saveField()}
            >
              Save
            </Button>
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
              <If predicate={() => vectorTools.is3d}>
                {() => componentInputR(vectorTools)}
              </If>
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

      {analysisSection(vectorTools)}

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

/**
 * Divergence, curl, and whether there is a potential: the three questions a
 * course asks of every field it draws, answered exactly where the algebra
 * allows and said plainly where it only checked.
 */
function analysisSection(vectorTools: VectorTools) {
  const analysis = () => vectorTools.fieldAnalysis;
  const worked = () => {
    const value = analysis();
    return value.ok ? value : undefined;
  };
  const verdict = () => {
    switch (worked()?.conservative) {
      case "gradient":
        return "Conservative: it is the gradient of f, so f is a potential and the work around any closed loop is 0.";
      case "exactly":
        return "Conservative: the curl is exactly 0, so on a region with no holes there is a potential f with ∇f = F.";
      case "numerically":
        return "Probably conservative: the curl vanishes at every one of the points checked across the sampling domain, though it did not simplify to 0.";
      case "no":
        return "Not conservative: the curl is not 0, so the work done depends on the path and there is no potential.";
      default:
        return "Whether it is conservative could not be checked here: the curl has no value at enough points.";
    }
  };
  return (
    <If predicate={() => worked() !== undefined}>
      {() => (
        <section class="dsm-vector-tools-section" data-vector-tools="analysis">
          <h3>Divergence and curl</h3>
          <div
            class="dsm-vector-tools-analysis-row"
            data-vector-tools="divergence"
            data-latex={() => worked()?.divergenceLatex ?? ""}
          >
            {/* The name as text: Desmos's MathQuill has no \nabla. */}
            <span class="dsm-vector-tools-analysis-name">∇·F =</span>
            <StaticMathQuillView
              latex={() => worked()?.divergenceLatex ?? ""}
            />
          </div>
          <div
            class="dsm-vector-tools-analysis-row"
            data-vector-tools="curl"
            data-latex={() => worked()?.curlLatex ?? ""}
          >
            <span class="dsm-vector-tools-analysis-name">∇×F =</span>
            <StaticMathQuillView latex={() => worked()?.curlLatex ?? ""} />
          </div>
          <div class="dsm-vector-tools-hint" data-vector-tools="conservative">
            {verdict}
          </div>
          <div class="dsm-vector-tools-hint">
            Divergence is how much the field spreads out of a point (positive is
            a source); curl is how much it spins there (positive is
            counter-clockwise).
          </div>
        </section>
      )}
    </If>
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
  const flow = () => config().flow;
  const arrowAdjust = (): ColorAdjust => ({
    saturation: color().saturation,
    contrast: color().contrast,
  });
  const flowAdjust = (): ColorAdjust =>
    // While the link is on the flow is drawn with the arrows' settings, so the
    // swatches under it have to be too or they would advertise a picture that
    // is not the one being drawn.
    vectorTools.matchFlowColor
      ? arrowAdjust()
      : { saturation: flow().saturation, contrast: flow().contrast };
  return (
    <div>
      {onTheGraphSection(vectorTools, config)}
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
        {sliderControl(
          "dsm-vector-tools-arrow-saturation",
          "Saturation",
          () => color().saturation,
          SATURATION_RANGE,
          (value) => vectorTools.setColor("saturation", value)
        )}
        {sliderControl(
          "dsm-vector-tools-arrow-contrast",
          "Contrast",
          () => color().contrast,
          CONTRAST_RANGE,
          (value) => vectorTools.setColor("contrast", value)
        )}
        <If predicate={usesPalette}>
          {() => (
            <div>
              {paletteChooser(
                "Palette",
                () => color().palette,
                (value) => vectorTools.setColor("palette", value),
                undefined,
                arrowAdjust
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
              {/* Their own pair rather than the arrows'. A particle is a faint
                  smear that thousands of its neighbours pile onto; an arrow is
                  a solid shape with graph paper showing around it. The numbers
                  that make one readable wash the other out. */}
              {sliderControl(
                "dsm-vector-tools-flow-saturation",
                "Saturation",
                () => config().flow.saturation,
                SATURATION_RANGE,
                (value) => vectorTools.setFlow("saturation", value)
              )}
              {sliderControl(
                "dsm-vector-tools-flow-contrast",
                "Contrast",
                () => config().flow.contrast,
                CONTRAST_RANGE,
                (value) => vectorTools.setFlow("contrast", value)
              )}
              {/* Direction runs along a cyclic ramp of its own and fixed takes
                  the shared swatch, so only speed has a ramp to choose. */}
              <If predicate={() => config().flow.colorMode === "speed"}>
                {() =>
                  paletteChooser(
                    "Particle palette",
                    () => config().flow.palette,
                    (value) => vectorTools.setFlow("palette", value),
                    undefined,
                    flowAdjust
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
 * Where the field sits relative to Desmos's own drawing, and what is behind it.
 *
 * These belong together because they are one decision made twice. Desmos's
 * graph canvas is transparent wherever it has not drawn something, so putting
 * the overlays underneath it lets the grid, the axes, the labels and every
 * plotted function come out on top of the field at full strength — which is the
 * whole reason to want a dark backdrop in the first place, and useless without
 * one if the field is drawn over the expressions it is meant to sit behind.
 */
function onTheGraphSection(vectorTools: VectorTools, config: ConfigGetter) {
  const flow = () => config().flow;
  return (
    <section class="dsm-vector-tools-section dsm-vector-tools-layer">
      {chipGroup(
        "Draw the field",
        () => vectorTools.overlayLayer,
        OVERLAY_LAYERS,
        (value) => vectorTools.setOverlayLayer(value),
        "dsm-vector-tools-overlay-layer"
      )}
      <div class="dsm-vector-tools-hint">
        {() =>
          vectorTools.overlayLayer === "under"
            ? "Your expressions, the axes and the grid are drawn on top of the field."
            : "The field covers the axes, the grid and anything plotted under it."
        }
      </div>
      {/* The backdrop is what the flow's palettes were built for: they run from
          near-black so the fast parts read as light, which on white graph paper
          makes the most visible end of the ramp the end meant to disappear. */}
      {checkboxControl(
        "Dark backdrop behind the field",
        () => flow().backdropEnabled,
        (checked) => vectorTools.setFlow("backdropEnabled", checked),
        "dsm-vector-tools-backdrop"
      )}
      <If predicate={() => flow().backdropEnabled}>
        {() => (
          <div>
            <div class="dsm-vector-tools-inline">
              <label
                class="dsm-vector-tools-label"
                for="dsm-vector-tools-backdrop-color"
              >
                Backdrop color
              </label>
              <input
                id="dsm-vector-tools-backdrop-color"
                type="color"
                onUpdate={(element: HTMLInputElement) => {
                  if (document.activeElement !== element)
                    element.value = flow().backdropColor;
                }}
                onInput={(event: Event) =>
                  vectorTools.setFlow(
                    "backdropColor",
                    (event.target as HTMLInputElement).value
                  )
                }
              />
            </div>
            {sliderControl(
              "dsm-vector-tools-backdrop-opacity",
              "Backdrop strength",
              () => flow().backdropOpacity,
              { minimum: 0, maximum: 1, step: 0.01, decimals: 2 },
              (value) => vectorTools.setFlow("backdropOpacity", value)
            )}
            <div class="dsm-vector-tools-hint">
              Drawn by the flow visualizer, so it only appears while that is
              running.
            </div>
          </div>
        )}
      </If>
    </section>
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
        {/* A toggle and a degree. The visual extras are meant to be a choice,
            and the strength survives being switched off. */}
        {checkboxControl(
          "Glow around each particle",
          () => flow().glowEnabled,
          (checked) => vectorTools.setFlow("glowEnabled", checked)
        )}
        <If predicate={() => flow().glowEnabled}>
          {() =>
            sliderControl(
              "dsm-vector-tools-flow-glow",
              "Glow strength",
              () => flow().glow,
              { minimum: 0.05, maximum: 1, step: 0.01, decimals: 2 },
              (value) => vectorTools.setFlow("glow", value)
            )
          }
        </If>
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

const FLUID_MODES: readonly Choice<FluidMode>[] = [
  { value: "off", label: "Off" },
  { value: "windTunnel", label: "Wind tunnel" },
  { value: "stirredBox", label: "Stirred box" },
];

const FLUID_SPEED_MODES: readonly Choice<FluidSpeedMode>[] = [
  { value: "auto", label: "Auto" },
  { value: "accurate", label: "Accurate" },
  { value: "lively", label: "Lively" },
];

const FLUID_PRECISIONS: readonly Choice<FluidPrecision>[] = [
  { value: "auto", label: "Auto" },
  { value: "full", label: "Full" },
  { value: "fast", label: "Fast" },
];

const FLUID_GUARD_MODES: readonly Choice<FluidGuardMode>[] = [
  { value: "auto", label: "Auto" },
  { value: "strict", label: "Strict" },
];

const FLUID_SHOWS: readonly Choice<FluidShow>[] = [
  { value: "vorticity", label: "Vorticity" },
  { value: "speed", label: "Speed" },
  { value: "pressure", label: "Pressure" },
];

/**
 * The Fluid tab, at gate 0: everything the solver will read, shown before
 * there is a solver to read it. The obstacles are compiled exactly as Desmos
 * shades them and drawn at lattice resolution, so a solid can be checked by
 * eye against the graph. The clock is the step scheduler that will drive the
 * lattice, and the GPU card is a measurement, not a list of extension names.
 */
function fluidTab(vectorTools: VectorTools, config: ConfigGetter) {
  const fluid = () => config().fluid;
  const session = vectorTools.fluid;
  return (
    <div class="dsm-vector-tools-fluid">
      <section class="dsm-vector-tools-section">
        {chipGroup(
          "Simulate",
          () => fluid().mode,
          FLUID_MODES,
          (value) => vectorTools.setFluid("mode", value),
          "dsm-vector-tools-fluid-mode"
        )}
        <div class="dsm-vector-tools-hint">
          {() =>
            fluid().mode === "stirredBox"
              ? `The field's P and Q push a closed box of fluid: the field gives the push its shape, scaled so the flow reaches about the typical speed. The fluid keeps the part of the push that curls, and answers the part that spreads with pressure, so a gradient field barely moves it: Helmholtz and Hodge's split, made visible.${
                  session.undefinedForceCells > 0
                    ? ` The field is undefined at ${session.undefinedForceCells.toLocaleString()} cells, and pushes nothing there.`
                    : ""
                }`
              : "Air flows in from the left of the tank and out at the right, round every region the graph shades. Hide a row to let the fluid through it."
          }
        </div>
        {chipGroup(
          "Show",
          () => fluid().show,
          FLUID_SHOWS,
          (value) => vectorTools.setFluid("show", value),
          "dsm-vector-tools-fluid-show"
        )}
        <If predicate={() => session.message !== ""}>
          {() => (
            <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-message">
              {() => session.message}
            </div>
          )}
        </If>
      </section>

      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-section-head">
          <div class="dsm-vector-tools-label">Tank</div>
          <Button
            color="light-gray"
            class="dsm-vector-tools-fluid-fit"
            onTap={() => vectorTools.fitFluidTankToView()}
          >
            Fit to view
          </Button>
        </div>
        <div class="dsm-vector-tools-number-grid">
          {fluidTankNumber(vectorTools, fluid, "xMin", "x minimum")}
          {fluidTankNumber(vectorTools, fluid, "xMax", "x maximum")}
          {fluidTankNumber(vectorTools, fluid, "yMin", "y minimum")}
          {fluidTankNumber(vectorTools, fluid, "yMax", "y maximum")}
          {numberControl(
            "dsm-vector-tools-fluid-cells",
            "Cells across",
            () => fluid().cellsAcross,
            (value) =>
              vectorTools.setFluid(
                "cellsAcross",
                Math.round(
                  Math.min(
                    FLUID_CELLS_MAXIMUM,
                    Math.max(FLUID_CELLS_MINIMUM, value)
                  )
                )
              )
          )}
        </div>
        <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-lattice">
          {() => {
            const { nx, ny } = fluidLatticeSize(fluid());
            return `${nx} × ${ny} cells, each ${formatNumber(session.units.dx)} across. The tank stays put when you pan; Fit to view moves it and restarts.`;
          }}
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-label">Solids</div>
        {IfElse(() => session.obstacleRows.length === 0, {
          true: () => (
            <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-no-solids">
              No inequality in the graph yet. Any region Desmos shades, such as
              x^2+y^2≤1, becomes a solid. Hide a row to let the fluid through.
            </div>
          ),
          false: () => (
            <div class="dsm-vector-tools-fluid-rows">
              <For
                each={() => session.obstacleRows.map((row) => row)}
                key={(row: ObstacleRow) => row.id}
              >
                {(row: () => ObstacleRow) => (
                  <div
                    class={() => ({
                      "dsm-vector-tools-fluid-row": true,
                      "dsm-vector-tools-fluid-row-error":
                        row().error !== undefined,
                      "dsm-vector-tools-fluid-row-hidden": row().hidden,
                    })}
                  >
                    <span
                      class="dsm-vector-tools-fluid-swatch"
                      style={() => ({ background: row().color })}
                    />
                    <div class="dsm-vector-tools-fluid-row-body">
                      <StaticMathQuillView latex={() => row().latex} />
                      <div class="dsm-vector-tools-fluid-row-status">
                        {() =>
                          row().error ??
                          (row().hidden
                            ? "Hidden, so the fluid passes through it."
                            : fluidRowStatus(session, row()))
                        }
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          ),
        })}
        <canvas
          class="dsm-vector-tools-fluid-mask"
          onUpdate={(canvas: HTMLCanvasElement) =>
            drawFluidMask(canvas, session)
          }
        />
        <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-mask-legend">
          {() => {
            const { mask } = session.mask;
            const undefinedNote =
              mask.undefinedCount > 0
                ? ` ${mask.undefinedCount.toLocaleString()} cells (amber) are where a solid's boundary is undefined; they stay fluid, as Desmos leaves them unshaded.`
                : "";
            return `What the fluid will see, cell by cell: ${mask.solidCount.toLocaleString()} solid.${undefinedNote}`;
          }}
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        {fluidReynoldsControl(vectorTools, fluid)}
        <div class="dsm-vector-tools-number-grid">
          {numberControl(
            "dsm-vector-tools-fluid-inflow",
            () =>
              fluid().mode === "stirredBox" ? "Typical speed" : "Inflow speed",
            () => fluid().inflowSpeed,
            (value) => {
              if (value > 0) vectorTools.setFluid("inflowSpeed", value);
            }
          )}
          {numberControl(
            "dsm-vector-tools-fluid-length",
            "Length for Re",
            () => fluid().referenceLength,
            (value) => {
              if (value > 0) vectorTools.setFluid("referenceLength", value);
            }
          )}
        </div>
        {chipGroup(
          "Lattice speed",
          () => fluid().speedMode,
          FLUID_SPEED_MODES,
          (value) => vectorTools.setFluid("speedMode", value),
          "dsm-vector-tools-fluid-speed"
        )}
        <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-units">
          {() => fluidUnitsText(session.units, fluid())}
        </div>
        {chipGroup(
          "Precision",
          () => fluid().precision,
          FLUID_PRECISIONS,
          (value) => vectorTools.setFluid("precision", value),
          "dsm-vector-tools-fluid-precision"
        )}
        <div class="dsm-vector-tools-hint">
          {() => fluidPrecisionText(session.storage, fluid())}
        </div>
        {chipGroup(
          "Resizing a solid",
          () => fluid().resizeMode,
          FLUID_GUARD_MODES,
          (value) => vectorTools.setFluid("resizeMode", value),
          "dsm-vector-tools-fluid-resize"
        )}
        <div class="dsm-vector-tools-hint">
          Auto lets you resize while it runs and marks the measurements as
          provisional until the flow settles. Strict restarts the flow whenever
          a solid changes size.
        </div>
        {chipGroup(
          "Dragging above Re 200",
          () => fluid().dragMode,
          FLUID_GUARD_MODES,
          (value) => vectorTools.setFluid("dragMode", value),
          "dsm-vector-tools-fluid-drag"
        )}
        <div class="dsm-vector-tools-hint">
          Auto allows it, without force numbers for the moving solid. Strict
          runs the flow at Re 200 while any solid reads a slider or t.
        </div>
        {checkboxControl(
          "Write measurements into the graph",
          () => fluid().writeback,
          (checked) => vectorTools.setFluid("writeback", checked),
          "dsm-vector-tools-fluid-writeback"
        )}
        <div class="dsm-vector-tools-hint dsm-vector-tools-fluid-writeback-note">
          {() =>
            session.writebackProblem !== ""
              ? session.writebackProblem
              : "Each solid, numbered from the top of the list, gets C_{D1}, C_{L1} and S_{t1} (then 2, 3, …) in a folder of their own. A value still settling reads as undefined, so nothing built on it uses a start-up transient."
          }
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-section-head">
          <div class="dsm-vector-tools-label">Clock</div>
          <div class="dsm-vector-tools-inline">
            <Button
              color="light-gray"
              class="dsm-vector-tools-fluid-play"
              onTap={() => vectorTools.setFluid("playing", !fluid().playing)}
            >
              {() => (fluid().playing ? "Pause" : "Play")}
            </Button>
            <Button
              color="light-gray"
              class="dsm-vector-tools-fluid-restart"
              onTap={() => session.restart()}
            >
              Restart
            </Button>
          </div>
        </div>
        <div class="dsm-vector-tools-fluid-clock">
          {() => fluidClockText(vectorTools)}
        </div>
      </section>

      <section class="dsm-vector-tools-section">
        <div class="dsm-vector-tools-label">This computer's GPU</div>
        <div
          class={() => ({
            "dsm-vector-tools-fluid-gpu": true,
            "dsm-vector-tools-fluid-gpu-ready":
              fluid().mode !== "off" && session.capabilities.ready,
          })}
        >
          {() => fluidCapabilityText(vectorTools)}
        </div>
      </section>
    </div>
  );
}

/**
 * A solid's line in the list: what it is, and once the flow is running, what
 * is measured on it. Drag and lift are coefficients against the length for
 * Re and the inflow speed, so they read like a textbook's.
 */
function fluidRowStatus(session: FluidSession, row: ObstacleRow) {
  const movable = row.obstacle!.usesTime || row.obstacle!.params.length > 0;
  const moves = row.obstacle!.usesTime
    ? "Solid, and it moves with t."
    : "Solid, and it moves with its sliders.";
  const kind = !movable
    ? "Solid."
    : session.reynoldsCapped
      ? `${moves} Strict runs it at Re 200, where moving solids are validated.`
      : moves;
  const measured = session.measurements.find((m) => m.rowId === row.id);
  if (!session.isSimulating || measured === undefined) return kind;
  if (!Number.isFinite(measured.drag))
    return measured.sheddingNote.includes("not measured")
      ? `${kind} ${measured.sheddingNote}`
      : `${kind} Measuring…`;
  const forces = `drag C_D ${measured.drag.toFixed(3)}, lift C_L ${measured.lift.toFixed(3)}`;
  if (!measured.settled)
    return `${kind} Provisional: ${forces}. ${measured.sheddingNote}`;
  const shedding =
    measured.strouhal === undefined
      ? measured.sheddingNote
      : `Shedding at St ${measured.strouhal.toFixed(3)}; forces averaged over the last cycle.`;
  return `${kind} ${forces}. ${shedding}`;
}

function fluidTankNumber(
  vectorTools: VectorTools,
  fluid: () => VectorFieldConfig["fluid"],
  key: "xMin" | "xMax" | "yMin" | "yMax",
  label: string
) {
  return numberControl(
    `dsm-vector-tools-fluid-${key}`,
    label,
    () => fluid().tank[key],
    (value) => {
      const tank = { ...fluid().tank, [key]: value };
      // A tank is a rectangle or nothing; a half-typed corner that crosses its
      // opposite waits for the rest of the edit rather than being stored.
      if (tank.xMax > tank.xMin && tank.yMax > tank.yMin)
        vectorTools.setFluid("tank", tank);
    }
  );
}

/** Re on a log slider, because 10 to 2000 is a range of ratios. */
function fluidReynoldsControl(
  vectorTools: VectorTools,
  fluid: () => VectorFieldConfig["fluid"]
) {
  const low = Math.log10(FLUID_REYNOLDS_MINIMUM);
  const high = Math.log10(FLUID_REYNOLDS_MAXIMUM);
  return (
    <div class="dsm-vector-tools-slider-row">
      <div class="dsm-vector-tools-slider-head">
        <label class="dsm-vector-tools-label" for="dsm-vector-tools-fluid-re">
          Reynolds number
        </label>
        <span class="dsm-vector-tools-slider-value">
          {() => `Re ${formatNumber(fluid().reynolds)}`}
        </span>
      </div>
      <input
        id="dsm-vector-tools-fluid-re"
        class="dsm-vector-tools-slider"
        type="range"
        min={low}
        max={high}
        step={0.01}
        onUpdate={(element: HTMLInputElement) => {
          if (document.activeElement !== element)
            element.value = String(Math.log10(fluid().reynolds));
        }}
        onInput={(event: Event) => {
          const position = Number((event.target as HTMLInputElement).value);
          // Two significant figures: a slider position is not a measurement,
          // and "Re 103.5" claims a precision nobody chose.
          const re = Number((10 ** position).toPrecision(2));
          vectorTools.setFluid(
            "reynolds",
            Math.min(
              FLUID_REYNOLDS_MAXIMUM,
              Math.max(FLUID_REYNOLDS_MINIMUM, re)
            )
          );
        }}
      />
    </div>
  );
}

function fluidPrecisionText(
  storage: "fp32" | "fp16s",
  fluid: VectorFieldConfig["fluid"]
) {
  const now =
    storage === "fp16s"
      ? "Half precision: about twice as fast, within 0.5% of full precision on the benchmarks."
      : "Full precision.";
  const why =
    fluid.precision !== "auto"
      ? ""
      : storage === "fp32"
        ? fluid.writeback
          ? " Auto uses it while measurements are written into the graph."
          : " Auto uses it with Accurate speed."
        : " Auto switches to full precision for Accurate speed or for writing measurements into the graph.";
  return now + why;
}

function fluidUnitsText(
  units: LatticeUnits,
  fluid: VectorFieldConfig["fluid"]
) {
  const closure = units.closure
    ? `the turbulence model is on (Smagorinsky C = ${SMAGORINSKY_C}), because Re is above ${CLOSURE_REYNOLDS}`
    : `no turbulence model is needed below Re ${CLOSURE_REYNOLDS}`;
  const speed =
    fluid.speedMode === "auto"
      ? " Auto starts here and halves the lattice speed if the flow anywhere passes Mach 0.3."
      : fluid.speedMode === "lively"
        ? " Lively keeps this speed, and says so while the flow anywhere passes Mach 0.3 and is not accurate."
        : "";
  const resolution =
    units.cellsPerLength < MEASUREMENT_CELLS
      ? ` The length for Re spans ${formatNumber(units.cellsPerLength)} cells; measurements want at least ${MEASUREMENT_CELLS}.`
      : "";
  return `${formatNumber(units.stepsPerSecond)} steps per second of flow, τ = ${units.tau.toFixed(3)}, inflow Mach ${units.inflowMach.toFixed(2)}; ${closure}.${speed}${resolution}`;
}

function fluidClockText(vectorTools: VectorTools) {
  const session = vectorTools.fluid;
  const { fluid } = vectorTools.getConfig();
  const plan = session.readout;
  const time = `t = ${plan.simulatedSeconds.toFixed(2)} s, ${plan.totalSteps.toLocaleString()} steps`;
  if (fluid.mode === "off") return `Off. ${time}.`;
  if (!fluid.playing) return `Paused at ${time}.`;
  const pace = plan.behind
    ? `running at ${plan.realTimeFactor.toFixed(2)}× real time because this computer cannot keep up`
    : `${plan.realTimeFactor.toFixed(2)}× real time`;
  return `${time}, ${pace}. Each step is ${formatNumber(session.units.dt * 1000)} ms of flow, whatever the screen's frame rate.`;
}

function fluidCapabilityText(vectorTools: VectorTools) {
  if (vectorTools.getConfig().fluid.mode === "off")
    return "Measured when a fluid is switched on.";
  const caps = vectorTools.fluid.capabilities;
  if (!caps.ready) return `Not ready: ${caps.problems.join(" ")}`;
  const fused =
    caps.fusedMultiplyAdd === true
      ? "fuses multiply-add"
      : caps.fusedMultiplyAdd === false
        ? "rounds every operation separately"
        : "did not say how it rounds";
  return `Ready. Float32 targets render and read back exactly; the shader compiler ${fused}; ${caps.maxDrawBuffers} targets per pass, textures up to ${caps.maxTextureSize.toLocaleString()} px, ${caps.fragmentPrecisionBits}-bit precision.`;
}

/** Draws the tank's cells: fluid pale, solid dark, undefined amber. */
function drawFluidMask(canvas: HTMLCanvasElement, session: FluidSession) {
  const { mask, nx, ny } = session.mask;
  if (canvas.width !== nx || canvas.height !== ny) {
    canvas.width = nx;
    canvas.height = ny;
  }
  const context = canvas.getContext("2d");
  if (context === null) return;
  const image = context.createImageData(nx, ny);
  for (let j = 0; j < ny; j++) {
    // Cell rows run upward from the tank's bottom; canvas rows run down.
    const row = ny - 1 - j;
    for (let i = 0; i < nx; i++) {
      const kind = mask.cells[j * nx + i];
      const k = (row * nx + i) * 4;
      const [r, g, b] =
        kind === CellKind.Solid
          ? [45, 58, 74]
          : kind === CellKind.Undefined
            ? [247, 214, 160]
            : [228, 238, 248];
      image.data[k] = r;
      image.data[k + 1] = g;
      image.data[k + 2] = b;
      image.data[k + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/** Three significant figures, without scientific notation for ordinary sizes. */
function formatNumber(value: number) {
  if (!Number.isFinite(value)) return String(value);
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return Math.round(value).toLocaleString();
  return Number(value.toPrecision(3)).toString();
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
 * R, the third component, shown only on Desmos 3D. Separate from the P and Q
 * slots because those are also generated into the expression list, and the
 * generator does not write 3D fields yet; R is read by the live arrows alone.
 */
function componentInputR(vectorTools: VectorTools) {
  return (
    <div>
      <label class="dsm-vector-tools-label">R(x, y, z)</label>
      <InlineMathInputViewGeneral
        containerClass={() => ({ "dsm-vector-tools-math-input": true })}
        placeholder="0"
        ariaLabel="R of x, y and z"
        latex={() => vectorTools.componentZLatex}
        handleLatexChanged={(latex) => vectorTools.setComponentZ(latex)}
        hasError={() => false}
        manageFocus={mathquillFocusHelper({
          controller: vectorTools.cc,
          location: {
            type: "dsm-focus",
            plugin: "vector-tools",
            kind: "r",
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

/**
 * Fields worth looking at, and the one toggle that decides how much of one
 * gets loaded.
 *
 * A gallery entry is a picture rather than a formula: its palette, its particle
 * settings and the frame it is meant to be seen in are most of what makes it
 * what it is, and loading only P and Q gives a black hole drawn as a grid of
 * short blue arrows. That is still worth being able to ask for, though — a
 * formula is a fine starting point inside a look somebody has already set up —
 * so which of the two happens is a checkbox rather than a decision made here.
 */
function gallerySection(vectorTools: VectorTools) {
  const withLook = () => vectorTools.galleryWithLook;
  return (
    <section class="dsm-vector-tools-section dsm-vector-tools-gallery">
      <div class="dsm-vector-tools-section-head">
        <h3>Gallery</h3>
      </div>
      <div class="dsm-vector-tools-gallery-row">
        <For
          each={() => [...vectorTools.gallery]}
          key={(preset: GalleryPreset) => preset.id}
        >
          {(getPreset: () => GalleryPreset) => (
            <span
              role="button"
              tabIndex={0}
              data-preset={() => getPreset().id}
              title={() => getPreset().blurb}
              class="dsm-vector-tools-chip dsm-vector-tools-gallery-chip"
              onTap={() =>
                vectorTools.applyGalleryPreset(getPreset().id, withLook())
              }
            >
              {() => getPreset().name}
            </span>
          )}
        </For>
      </div>
      {checkboxControl(
        "Also take its framing, particle settings and arrow mode",
        withLook,
        (checked) => vectorTools.setGalleryWithLook(checked)
      )}
      <div class="dsm-vector-tools-hint">
        {() =>
          withLook()
            ? "Loading one replaces the field you are editing, including your sampling domain and flow settings. Save first to keep them."
            : "The formula and the colours are loaded. Your sampling domain, arrows and flow settings stay as they are."
        }
      </div>
    </section>
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
  id?: string,
  // The swatches are drawn at the saturation and contrast the field is drawn
  // at, so that choosing a ramp is choosing what you can see rather than what
  // it would look like at settings nobody is using. A function, because a
  // swatch built once would stop tracking the sliders the moment they moved.
  adjust: () => ColorAdjust = () => NO_COLOR_ADJUST
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
                    style={() => ({
                      background: paletteCSSGradient(pid, adjust()),
                    })}
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
  // A function for a label that changes with a setting, such as the fluid's
  // inflow speed, which is a typical speed in the stirred box.
  label: string | (() => string),
  value: () => number,
  onChange: (value: number) => void,
  disabled: () => boolean = () => false
) {
  return (
    <label class="dsm-vector-tools-number" for={id}>
      <span>{typeof label === "string" ? label : () => label()}</span>
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
