/**
 * The arrows, drawn by this extension instead of by Desmos.
 *
 * The generator writes a field as ordinary Desmos expressions, which is what
 * makes a graph shareable — but it costs three restricted parametrics per
 * arrow, and Desmos starts to labour somewhere under ten thousand of them. This
 * draws the same field on the overlay canvas instead: one instance per arrow,
 * the field evaluated in the vertex shader, no expressions written and no cap
 * worth naming.
 *
 * What it buys beyond speed is the arrowhead. A Desmos arrowhead is two line
 * segments, because a filled triangle per arrow would be a polygon per arrow;
 * here it is three vertices, so the heads are solid and taper the way a drawn
 * vector field's do. The head also shrinks on a short arrow rather than
 * swallowing it.
 *
 * Nothing here animates. Arrows are redrawn when the view, the field or the
 * settings change, and sit still otherwise.
 */
import {
  fieldFunctions,
  uploadFieldParameters,
  FlowRendererError,
  hexToUnitRGB,
} from "./FlowRenderer";
import type { FlowBounds, FlowField } from "./FlowRenderer";
import { PALETTE_GLSL, paletteUniforms, type PaletteID } from "./palettes";
import type {
  ColorRangeMode,
  VectorColorMode,
  VectorLengthMode,
} from "./types";

export interface ArrowOptions {
  /** Sample counts across the domain, which is one arrow per grid point. */
  columns: number;
  rows: number;
  domain: FlowBounds;
  lengthMode: VectorLengthMode;
  targetLength: number;
  scale: number;
  maximumLength: number;
  compression: number;
  /** Length of the arrowhead in graph units, before it is capped on a short arrow. */
  headSize: number;
  /**
   * Draw each mark centred on its sample point rather than starting from it.
   *
   * A vector has a tail: it points *from* somewhere, so an arrow starting at
   * the grid point is the honest picture. A slope field mark does not — it is
   * a tangent line through the point, and drawing it from the point puts the
   * whole mark on one side of the thing it is tangent to, which reads as a
   * field of little vectors instead of a field of slopes.
   *
   * Optional, and off unless asked, so a vector field is unaffected.
   */
  centered?: boolean;
  headAngle: number;
  /** Shaft thickness in CSS pixels, so it does not change with the zoom. */
  shaftWidth: number;
  colorMode: VectorColorMode;
  palette: PaletteID;
  fixedColor: string;
  /**
   * How far the chosen colours are pushed, once chosen.
   *
   * See `ColorAdjust` in `./palettes`, which is where both the meaning and the
   * arithmetic live — the flow visualizer takes the same pair, so that a field
   * drawn both ways is drawn the same way twice.
   */
  saturation: number;
  contrast: number;
  opacity: number;
  rangeMode: ColorRangeMode;
  rangeMinimum: number;
  rangeMaximum: number;
  /**
   * A colour to clear to before the arrows, as the flow's backdrop does
   * (`FlowOptions.backdrop`), for when the arrows are drawn without the flow.
   * Empty or absent for none.
   */
  backdrop?: string;
  backdropOpacity?: number;
}

export const DEFAULT_ARROW_OPTIONS: ArrowOptions = {
  columns: 21,
  rows: 13,
  domain: { xMin: -10, xMax: 10, yMin: -6, yMax: 6 },
  lengthMode: "normalized",
  targetLength: 0.6,
  scale: 1,
  maximumLength: 1,
  compression: 1,
  headSize: 0.22,
  headAngle: 0.42,
  shaftWidth: 2.4,
  colorMode: "magnitude",
  palette: "spectral",
  fixedColor: "#6042a6",
  saturation: 1,
  contrast: 1,
  opacity: 1,
  rangeMode: "automatic",
  rangeMinimum: 0,
  rangeMaximum: 1,
};

const LENGTH_MODE_INDEX: Record<VectorLengthMode, number> = {
  actual: 0,
  normalized: 1,
  scaled: 2,
  clamped: 3,
  compressed: 4,
  "direction-only": 1,
};

const COLOR_MODE_INDEX: Record<VectorColorMode, number> = {
  fixed: 0,
  magnitude: 1,
  "log-magnitude": 2,
  direction: 3,
  "x-component": 4,
  "y-component": 5,
};

/** Vertices per arrow: two triangles of shaft, one of head. */
const VERTICES_PER_ARROW = 9;

/**
 * How far outside the view an arrow's grid point can sit and still show.
 *
 * An arrow is drawn from its grid point, and the shader caps its length at
 * 0.12 of the viewport's width however the length was chosen, so nothing whose
 * base is further out than that can reach the screen. The margin is a little
 * larger than the cap so the arrowhead's own width is covered too, and it is
 * the same on both axes because the cap is a length, not a horizontal extent.
 */
const CULL_MARGIN_FRACTION = 0.15;

/**
 * The part of the sampling grid that could put an arrow on screen.
 *
 * The grid belongs to the sampling *domain*, which has nothing to do with what
 * is in view: matching the domain to a zoomed-out viewport and then zooming
 * back in leaves almost every arrow off screen, and each one still costs a
 * vertex shader that evaluates the field before the clipper throws it away.
 * Instancing only the rows and columns that intersect the view — plus the
 * margin above — makes the cost follow what is being looked at rather than
 * what was configured.
 *
 * Exported because the arithmetic is the whole of it, and a wrong answer here
 * is arrows quietly missing from the edge of the screen, which is exactly the
 * kind of thing a picture makes look like a rendering bug.
 */
export function visibleGridSpan(
  options: Pick<ArrowOptions, "columns" | "rows" | "domain">,
  bounds: FlowBounds
) {
  const columns = Math.max(0, Math.floor(options.columns));
  const rows = Math.max(0, Math.floor(options.rows));
  const width = Math.abs(bounds.xMax - bounds.xMin);
  const margin = CULL_MARGIN_FRACTION * width;
  const x = axisSpan(
    options.domain.xMin,
    options.domain.xMax,
    columns,
    Math.min(bounds.xMin, bounds.xMax) - margin,
    Math.max(bounds.xMin, bounds.xMax) + margin
  );
  const y = axisSpan(
    options.domain.yMin,
    options.domain.yMax,
    rows,
    Math.min(bounds.yMin, bounds.yMax) - margin,
    Math.max(bounds.yMin, bounds.yMax) + margin
  );
  return {
    column: x.start,
    row: y.start,
    columns: x.span,
    rows: y.span,
  };
}

/**
 * The sample indices along one axis whose coordinates land inside `[lo, hi]`.
 *
 * Anything it cannot reason about — a non-finite bound, a domain of zero
 * width — falls back to the whole axis, because drawing too much is a
 * performance answer and drawing too little is a wrong picture.
 */
function axisSpan(
  domainMin: number,
  domainMax: number,
  count: number,
  lo: number,
  hi: number
) {
  const whole = { start: 0, span: count };
  if (count <= 0) return { start: 0, span: 0 };
  if (![domainMin, domainMax, lo, hi].every(Number.isFinite)) return whole;
  if (count === 1 || domainMin === domainMax) {
    return domainMin >= lo && domainMin <= hi ? whole : { start: 0, span: 0 };
  }
  const step = (domainMax - domainMin) / (count - 1);
  const a = (lo - domainMin) / step;
  const b = (hi - domainMin) / step;
  const start = Math.max(0, Math.ceil(Math.min(a, b)));
  const end = Math.min(count, Math.floor(Math.max(a, b)) + 1);
  return { start, span: Math.max(0, end - start) };
}

export class ArrowRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly emptyArray: WebGLVertexArrayObject;
  private program?: {
    program: WebGLProgram;
    uniforms: Record<string, WebGLUniformLocation | null>;
  };
  /**
   * The drawing-buffer rectangle the last frame drew into.
   *
   * Exposed because the measuring pass renders into a buffer of its own, and
   * leaving the viewport at that size drew the whole field into a corner. That
   * failure is invisible to anything except the pixels, so this is what the
   * test looks at instead.
   */
  lastViewport = { width: 0, height: 0 };
  /**
   * The range, and the box it was measured over, that the last frame coloured
   * against.
   *
   * Exposed for the same reason as the viewport above: measuring the range over
   * the wrong box draws a perfectly valid picture in one flat colour, and
   * nothing but the pixels can tell.
   */
  private options: ArrowOptions = { ...DEFAULT_ARROW_OPTIONS };
  private bounds: FlowBounds = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  private destroyed = false;
  /**
   * The field the linked program was built from.
   *
   * Every settings change arrives here as a `setField` with the same field, and
   * relinking a program is the most expensive thing this class can be asked to
   * do — so a drag on the arrowhead slider used to compile and link a shader
   * per pointermove. The flow renderer has kept the same guard for the same
   * reason.
   */
  private fieldSource?: string;
  /** The field currently linked, so its parameter names are to hand each frame. */
  private linkedField?: FlowField;
  private parameters: ReadonlyMap<string, number> = new Map();
  /** Seconds on the animation clock, uploaded as `u_time` when the field reads it. */
  private time = 0;
  /** How many instances the last frame actually drew, after culling. */
  drawnArrowCount = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (gl === null) {
      throw new FlowRendererError(
        "This browser could not open a WebGL2 canvas for the arrows."
      );
    }
    this.gl = gl;
    const array = gl.createVertexArray();
    if (array === null)
      throw new FlowRendererError("Could not set up the arrow renderer.");
    // The geometry comes from gl_VertexID and gl_InstanceID, so the draw needs
    // a bound vertex array but no buffers in it at all.
    this.emptyArray = array;
  }

  setOptions(options: ArrowOptions) {
    this.options = { ...options };
  }

  setBounds(bounds: FlowBounds) {
    this.bounds = bounds;
  }

  /**
   * The current value of every name the field reads.
   *
   * Separate from `setField` on purpose: these change as often as a slider is
   * dragged, and routing them through the field would relink a shader per
   * frame of that drag.
   */
  setParameters(values: ReadonlyMap<string, number>) {
    this.parameters = values;
  }

  setTime(seconds: number) {
    this.time = seconds;
  }

  setField(field: FlowField) {
    const { gl } = this;
    // The compilation is cached upstream, so an unchanged field arrives as the
    // same object. Checking that first avoids serialising the whole thing —
    // including every helper's GLSL — once per settings change.
    if (this.linkedField === field && this.program !== undefined) return;
    const key = JSON.stringify(field);
    if (this.fieldSource === key && this.program !== undefined) return;
    if (this.program !== undefined) gl.deleteProgram(this.program.program);
    this.program = this.createProgram(field);
    this.linkedField = field;
    this.fieldSource = key;
  }

  /** Whether the GPU has taken the context away underneath this renderer. */
  get isContextLost() {
    return this.gl.isContextLost();
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number) {
    const width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
    if (width === this.canvas.width && height === this.canvas.height) return;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** Clears to the backdrop, premultiplied as the canvas is, or to nothing. */
  private clearToBackdrop() {
    const { gl } = this;
    const { backdrop, backdropOpacity } = this.options;
    const alpha = Math.min(1, Math.max(0, backdropOpacity ?? 1));
    if (backdrop === undefined || backdrop === "" || alpha <= 0) {
      gl.clearColor(0, 0, 0, 0);
    } else {
      const [r, g, b] = hexToUnitRGB(backdrop);
      gl.clearColor(r * alpha, g * alpha, b * alpha, alpha);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  get arrowCount() {
    return Math.max(0, this.options.columns) * Math.max(0, this.options.rows);
  }

  frame() {
    const { gl } = this;
    if (this.destroyed || this.program === undefined) return;
    const span = visibleGridSpan(this.options, this.bounds);
    const count = span.columns * span.rows;
    this.drawnArrowCount = count;
    if (count === 0) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.clearToBackdrop();
      this.lastViewport = {
        width: this.canvas.width,
        height: this.canvas.height,
      };
      return;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.lastViewport = {
      width: this.canvas.width,
      height: this.canvas.height,
    };
    this.clearToBackdrop();

    const { uniforms, program } = this.program;
    gl.useProgram(program);
    gl.bindVertexArray(this.emptyArray);
    uploadFieldParameters(
      gl,
      uniforms,
      this.linkedField,
      this.parameters,
      this.time
    );
    gl.enable(gl.BLEND);
    // Premultiplied, matching the flow, so the two layers composite the same way.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const { xMin, xMax, yMin, yMax } = this.bounds;
    const { options } = this;
    gl.uniform2f(uniforms.u_min, xMin, yMin);
    gl.uniform2f(uniforms.u_max, xMax, yMax);
    gl.uniform2f(
      uniforms.u_viewportPx,
      Math.max(1, this.canvas.width),
      Math.max(1, this.canvas.height)
    );
    gl.uniform2i(
      uniforms.u_grid,
      Math.max(1, options.columns),
      Math.max(1, options.rows)
    );
    gl.uniform2i(uniforms.u_gridOrigin, span.column, span.row);
    gl.uniform2i(uniforms.u_gridSpan, span.columns, span.rows);
    gl.uniform4f(
      uniforms.u_domain,
      options.domain.xMin,
      options.domain.yMin,
      options.domain.xMax,
      options.domain.yMax
    );
    gl.uniform1i(uniforms.u_lengthMode, LENGTH_MODE_INDEX[options.lengthMode]);
    gl.uniform1f(uniforms.u_targetLength, options.targetLength);
    gl.uniform1f(uniforms.u_scale, options.scale);
    gl.uniform1f(uniforms.u_maxLength, options.maximumLength);
    gl.uniform1f(uniforms.u_compression, Math.max(1e-6, options.compression));
    gl.uniform1f(uniforms.u_headSize, options.headSize);
    gl.uniform1f(uniforms.u_headAngle, options.headAngle);
    gl.uniform1f(
      uniforms.u_shaftWidth,
      options.shaftWidth *
        (this.canvas.width /
          Math.max(1, this.canvas.clientWidth || this.canvas.width))
    );
    gl.uniform1i(uniforms.u_centered, options.centered === true ? 1 : 0);
    gl.uniform1f(uniforms.u_opacity, options.opacity);
    gl.uniform1i(uniforms.u_colorMode, COLOR_MODE_INDEX[options.colorMode]);
    const [r, g, b] = hexToUnitRGB(options.fixedColor);
    gl.uniform3f(uniforms.u_fixedColor, r, g, b);
    gl.uniform1f(uniforms.u_speedScale, Math.max(1e-6, (xMax - xMin) / 3));
    const { rangeMode, rangeMinimum, rangeMaximum } = this.options;
    gl.uniform1i(uniforms.u_manualRange, rangeMode === "manual" ? 1 : 0);
    gl.uniform2f(uniforms.u_range, rangeMinimum, rangeMaximum);
    const palette = paletteUniforms(options.palette);
    gl.uniform1fv(uniforms.u_paletteAt, palette.positions);
    gl.uniform3fv(uniforms.u_paletteRGB, palette.colors);
    gl.uniform1i(uniforms.u_paletteCount, palette.count);
    gl.uniform1i(
      uniforms.u_paletteIsHue,
      options.palette === "direction-hue" ? 1 : 0
    );
    gl.uniform1f(uniforms.u_saturation, options.saturation);
    gl.uniform1f(uniforms.u_contrast, options.contrast);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTICES_PER_ARROW, count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const { gl } = this;
    if (this.program !== undefined) gl.deleteProgram(this.program.program);
    gl.deleteVertexArray(this.emptyArray);
    this.program = undefined;
    this.fieldSource = undefined;
  }

  private createProgram(field: FlowField) {
    return this.linkProgram(
      arrowVertexShader(field),
      ARROW_FRAGMENT_SHADER,
      "arrow"
    );
  }

  private linkProgram(
    vertexSource: string,
    fragmentSource: string,
    name: string
  ) {
    const { gl } = this;
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (program === null)
      throw new FlowRendererError(`Could not create the ${name} program.`);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program) ?? "";
      gl.deleteProgram(program);
      throw new FlowRendererError(
        `Could not link the ${name} shader. ${log}`.trim()
      );
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info === null) continue;
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
      const array = /^(.*)\[0\]$/.exec(info.name);
      if (array !== null) uniforms[array[1]] = uniforms[info.name];
    }
    return { program, uniforms };
  }

  private compileShader(type: number, source: string) {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (shader === null)
      throw new FlowRendererError("Could not create an arrow shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new FlowRendererError(
        `The field could not be drawn as arrows. ${log}`.trim()
      );
    }
    return shader;
  }
}

/**
 * One arrow per instance, nine vertices each, and no vertex buffer.
 *
 * The shaft is a quad and the head a triangle, both written in a frame where
 * the arrow runs along +x from its grid point. `gl_VertexID` picks the corner
 * and `gl_InstanceID` the grid point, so the whole field is one draw call over
 * geometry that only exists in this shader.
 */
function arrowVertexShader(field: FlowField) {
  return `#version 300 es
precision highp float;
uniform vec2 u_min;
uniform vec2 u_max;
uniform vec2 u_viewportPx;
uniform ivec2 u_grid;
/** The first column and row instanced, and how many of each: see visibleGridSpan. */
uniform ivec2 u_gridOrigin;
uniform ivec2 u_gridSpan;
uniform vec4 u_domain;
uniform int u_lengthMode;
uniform float u_targetLength;
uniform float u_scale;
uniform float u_maxLength;
uniform float u_compression;
uniform float u_headSize;
uniform float u_headAngle;
uniform float u_shaftWidth;
uniform int u_centered;
uniform float u_opacity;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform float u_speedScale;
uniform vec2 u_range;
uniform int u_manualRange;
out vec4 v_color;

${fieldFunctions(field)}
${PALETTE_GLSL}

const vec2 SHAFT[6] = vec2[6](
  vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  vec2(0.0, -1.0), vec2(1.0, 1.0), vec2(0.0, 1.0)
);
const vec2 HEAD[3] = vec2[3](
  vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(0.0, 1.0)
);

/** The same factor the generated expressions scale a vector by. */
float vtLengthFactor(float magnitude) {
  float safe = max(magnitude, 1.0e-9);
  if (u_lengthMode == 0) return 1.0;
  if (u_lengthMode == 1) return u_targetLength / safe;
  if (u_lengthMode == 2) return u_scale;
  if (u_lengthMode == 3) return min(u_scale * magnitude, u_maxLength) / safe;
  return u_scale * log(1.0 + u_compression * magnitude) /
         (u_compression * safe);
}

vec3 vtArrowColor(vec2 v, float magnitude) {
  // vtPalette adjusts its own stops, so only the two colours that never
  // went through a ramp are adjusted here.
  if (u_colorMode == 0) return vtAdjust(u_fixedColor);
  if (u_colorMode == 3) {
    return vtAdjust(vtHueRamp(fract(atan(v.y, v.x) / 6.2831853 + 1.0)));
  }
  if (u_colorMode == 4 || u_colorMode == 5) {
    // Signed, so the ramp is entered from its middle outwards.
    float component = u_colorMode == 4 ? v.x : v.y;
    return vtPalette(0.5 + 0.5 * tanh(component / u_speedScale));
  }
  if (u_manualRange == 1) {
    float m = u_colorMode == 2 ? log(1.0 + max(magnitude, 0.0)) : magnitude;
    float span = max(u_range.y - u_range.x, 1.0e-9);
    return vtPalette(clamp((m - u_range.x) / span, 0.0, 1.0));
  }
  // The same ramp the flow uses, so an arrow and the particles over it are the
  // same colour. It saturates rather than stretching between two ends, which
  // is what lets a field with a pole in it be drawn at all: ordinary
  // magnitudes get most of the ramp and the poles run into the end of it,
  // instead of one value from beside a pole taking the whole thing.
  if (u_colorMode == 2) {
    // Logarithms of the same ramp, so the scale means the same in both: a
    // magnitude of u_speedScale lands in the same place either way.
    float scale = log(1.0 + u_speedScale);
    return vtPalette(
      1.0 - exp(-log(1.0 + max(magnitude, 0.0)) / max(scale, 1.0e-9))
    );
  }
  return vtPalette(1.0 - exp(-magnitude / u_speedScale));
}


void main() {
  // Instances cover only the visible part of the grid, but the spacing is still
  // the whole domain's, so the arrows stay on the same points as they always
  // were and merely stop being drawn once they are far enough off screen.
  int column = u_gridOrigin.x + gl_InstanceID % max(u_gridSpan.x, 1);
  int row = u_gridOrigin.y + gl_InstanceID / max(u_gridSpan.x, 1);
  vec2 counts = max(vec2(u_grid) - 1.0, vec2(1.0));
  vec2 step = (u_domain.zw - u_domain.xy) / counts;
  vec2 base = u_domain.xy + vec2(float(column), float(row)) * step;

  vec2 v = vtField(base);
  float magnitude = length(v);
  vec2 shown = v * vtLengthFactor(magnitude);
  float drawn = length(shown);

  // A zero vector has no direction to draw, and a degenerate triangle would
  // still be rasterized. Send it outside the clip volume instead.
  if (magnitude <= 1.0e-9 || drawn <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  // The direction has to come from the unclamped vector: normalizing by the
  // clamped length would scale the direction back up by exactly the amount the
  // clamp took off, and the arrow would come out its original size.
  vec2 dir = shown / drawn;
  // However the length was chosen, an arrow longer than a fraction of the view
  // says nothing — it leaves the screen before its direction reads. This bites
  // when the sampling domain is far larger than what is on screen, where the
  // spacing the length follows is itself larger than the viewport.
  float len = min(drawn, 0.12 * (u_max.x - u_min.x));
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 unitsPerPixel = (u_max - u_min) / u_viewportPx;
  // Thickness is in pixels so it does not change with the zoom — but a pixel is
  // worth more graph units the further out you go, and left alone the shaft
  // ends up wider than the arrow is long. Past that point it is not an arrow
  // any more, just a blob square to its own direction, and a field of them
  // smears into a wash. So the pixel width is also capped against the length.
  float pixel = 0.5 * (unitsPerPixel.x + unitsPerPixel.y);
  // Thin enough never to be wider than long, but never thinner than about half
  // a pixel, or a dense field disappears instead of reading as a fine texture.
  float halfWidth = max(
    min(0.5 * u_shaftWidth * pixel, 0.2 * len),
    0.3 * pixel
  );

  // The head is capped against the arrow's own length, so a short vector keeps
  // a visible shaft instead of becoming a triangle on a dot.
  float headLength = min(u_headSize, 0.45 * len);
  // A head narrower than about twice the shaft does not read as a head at all,
  // so the angle sets its width only while that stays true — and never wider
  // than the arrow is long, for the same reason as the shaft.
  float headHalf = min(
    max(headLength * tan(u_headAngle), 2.4 * halfWidth),
    0.5 * len
  );
  float shaftEnd = max(len - headLength, 0.0);

  vec2 local;
  if (gl_VertexID < 6) {
    vec2 corner = SHAFT[gl_VertexID];
    local = vec2(corner.x * shaftEnd, corner.y * halfWidth);
  } else {
    vec2 corner = HEAD[gl_VertexID - 6];
    local = vec2(mix(shaftEnd, len, corner.x), corner.y * headHalf);
  }

  // The field is still sampled at the grid point; only the mark drawn from it
  // moves, back along its own direction by half its length.
  vec2 origin = base - dir * (u_centered == 1 ? 0.5 * len : 0.0);
  vec2 world = origin + dir * local.x + perp * local.y;
  vec2 normalized = (world - u_min) / (u_max - u_min);
  gl_Position = vec4(2.0 * normalized - 1.0, 0.0, 1.0);

  float alpha = clamp(u_opacity, 0.0, 1.0);
  v_color = vec4(vtArrowColor(v, magnitude) * alpha, alpha);
}
`;
}

const ARROW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }
`;
