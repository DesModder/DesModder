/**
 * GPU particle advection for the Vector Tools flow visualizer.
 *
 * The technique — ping-ponged particle-state textures, an RK4 step in a
 * fragment shader, particles drawn into a trail texture that fades a little
 * every frame — is adapted from Andrei Kashcha's fieldplay
 * (https://github.com/anvaka/fieldplay, MIT licensed; see LICENSE-fieldplay.md
 * in this directory).
 *
 * The port differs from the original in three ways that matter here:
 *  - It targets WebGL2 and stores particle state in a float texture, so the
 *    RGBA float packing/unpacking fieldplay needs for WebGL1 is gone.
 *  - Its bounds are driven by Desmos's graphpaper bounds rather than its own
 *    pan/zoom, so the flow stays registered with the graph underneath it.
 *  - It renders onto a transparent canvas layered over the Desmos graph
 *    instead of owning the whole screen.
 */
import { PALETTE_GLSL, paletteUniforms, type PaletteID } from "./palettes";
import {
  fieldFunctions,
  uploadFieldParameters,
  FlowRendererError,
} from "./field";
import type { FlowBounds, FlowField } from "./field";
import type { FlowColorMode } from "./types";

// Re-exported so the parts that only ever wanted a field keep one import.
export {
  fieldFunctions,
  uploadFieldParameters,
  FlowRendererError,
} from "./field";
export type { FlowBounds, FlowField } from "./field";

export interface FlowOptions {
  /**
   * Exact number of particles. Storage is allocated in coarser steps (see
   * {@link particleCapacityFor}), but only this many are ever advanced or
   * drawn, so any value works and the count you ask for is the count you get.
   */
  particleCount: number;
  /** Relative step size for the integrator. */
  speed: number;
  /** How much of the previous frame survives, 0..1. Higher means longer trails. */
  trailPersistence: number;
  /** Per-frame chance that a particle restarts somewhere random, 0..1. */
  dropRate: number;
  pointSize: number;
  /**
   * How much of a halo each particle draws around itself, 0..1.
   *
   * At 0 a particle is the flat disc it has always been. Above that it gains a
   * soft falloff around a brighter core, which is the difference between a
   * field drawn in dots and one drawn in light — thousands of overlapping
   * haloes accumulate into the diffuse glow that makes a dense flow read as
   * luminous rather than stippled.
   *
   * It costs fill rate rather than particles: the sprite has to grow for the
   * halo to have anywhere to go, so the area drawn per particle grows with it.
   * The spread is capped for that reason.
   */
  glow: number;
  /**
   * A colour laid under the particles, as `#rrggbb`, or "" for none.
   *
   * The palettes built for this run from near-black to near-white, because a
   * particle's dark end is where it fades out and starting near black is what
   * makes the bright end read as light. On Desmos's white graph paper that is
   * exactly backwards: the dark end of the ramp is the most visible part of it,
   * and a field drawn in light comes out as navy scribble.
   *
   * Laying down a dark backdrop first is what fixes it, and it is a genuine
   * trade rather than an improvement — the graph paper, the axes and every
   * other expression go behind it. `backdropOpacity` is how much of them
   * survives.
   */
  backdrop: string;
  /** How opaque the backdrop is, 0..1. */
  backdropOpacity: number;
  opacity: number;
  colorMode: FlowColorMode;
  /** The ramp the `speed` color mode runs along, shared with the arrows. */
  palette: PaletteID;
  /** Hex color used by the `fixed` color mode. */
  fixedColor: string;
  /** Draw streamlines at a constant speed instead of the field's own magnitude. */
  normalizeSpeed: boolean;
  /**
   * Fraction of the display's own pixels to render at, 0..1.
   *
   * Three of the four passes in a frame cover the whole canvas, so their cost
   * is the drawing buffer's area — which on a high-density display is four
   * times the area of the CSS box. Trails are soft and faded, so halving this
   * quarters that work for very little visible difference. It scales the
   * device pixel ratio rather than replacing it, so the setting means the same
   * thing on every screen.
   */
  renderScale: number;
}

export const DEFAULT_FLOW_OPTIONS: FlowOptions = {
  particleCount: 16_000,
  speed: 1,
  trailPersistence: 0.95,
  dropRate: 0.01,
  pointSize: 2,
  glow: 0.45,
  backdrop: "",
  backdropOpacity: 0.9,
  opacity: 0.42,
  colorMode: "speed",
  palette: "spectral",
  fixedColor: "#6042a6",
  normalizeSpeed: true,
  renderScale: 1,
};

interface ProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

/**
 * The per-vertex attribute slot every program uses.
 *
 * Each program has exactly one vertex attribute — the screen quad's `a_pos` or
 * the draw pass's `a_index` — and both are bound here before linking. Pinning
 * the slot is what lets one vertex array object per buffer be shared by every
 * program that reads it, instead of re-pointing the attribute each frame.
 */
const VERTEX_ATTRIBUTE_SLOT = 0;

/**
 * The smallest capacity ever allocated. Below this the textures are too small
 * for the allocation to be worth avoiding.
 */
const MINIMUM_PARTICLE_CAPACITY = 512;

/**
 * Storage capacity for a requested particle count, rounded up to a power of
 * two.
 *
 * The count slider fires on every pointermove, so the count itself cannot own
 * an allocation: at the 400,000 maximum, reallocating per move would delete and
 * recreate two float textures and upload a fresh multi-megabyte seed array
 * every frame of the drag. Capacity is what owns the textures, and it only
 * changes at the ~10 power-of-two boundaries across the whole slider range.
 * Everywhere else a count change is one field assignment.
 */
export function particleCapacityFor(count: number) {
  const wanted = Number.isFinite(count) ? Math.ceil(count) : 0;
  let capacity = MINIMUM_PARTICLE_CAPACITY;
  // Doubling rather than 2 ** ceil(log2(n)) so an exact power of two cannot
  // round up through a floating-point logarithm.
  while (capacity < wanted) capacity *= 2;
  return capacity;
}

/** Side of the square texture that holds `capacity` particles. */
export function particleResolutionFor(capacity: number) {
  return Math.max(1, Math.ceil(Math.sqrt(capacity)));
}

/** Where in the old trail texture each texel of the new view came from. */
export interface TrailReprojection {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Reads the old trail under new bounds: a texel at `uv` in the new view held
 * whatever sat at `offset + uv * scale` in the old one.
 *
 * Returns undefined for bounds with no extent, which nothing can be carried
 * across — the caller clears instead.
 */
export function trailReprojection(
  from: FlowBounds,
  to: FlowBounds
): TrailReprojection | undefined {
  const width = from.xMax - from.xMin;
  const height = from.yMax - from.yMin;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  if (width === 0 || height === 0) return undefined;
  return {
    scaleX: (to.xMax - to.xMin) / width,
    scaleY: (to.yMax - to.yMin) / height,
    offsetX: (to.xMin - from.xMin) / width,
    offsetY: (to.yMin - from.yMin) / height,
  };
}

export class FlowRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly quadBuffer: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer;

  private updateProgram?: ProgramInfo;
  private drawProgram?: ProgramInfo;
  private readonly fadeProgram: ProgramInfo;
  private readonly blitProgram: ProgramInfo;
  private readonly reprojectProgram: ProgramInfo;

  private readonly quadArray: WebGLVertexArrayObject;
  private indexArray?: WebGLVertexArrayObject;

  private particleRead?: WebGLTexture;
  private particleWrite?: WebGLTexture;
  private indexBuffer?: WebGLBuffer;
  private particleResolution = 0;
  private particleCapacity = 0;
  private particleCount = 0;

  private trailFront?: WebGLTexture;
  private trailBack?: WebGLTexture;
  private trailWidth = 0;
  private trailHeight = 0;

  private options: FlowOptions = { ...DEFAULT_FLOW_OPTIONS };
  private bounds: FlowBounds = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };
  private fieldSource?: string;
  /** The field currently linked, so its parameter names are to hand each frame. */
  private linkedField?: FlowField;
  private parameters: ReadonlyMap<string, number> = new Map();
  /** Seconds on the animation clock, uploaded as `u_time` when the field reads it. */
  private time = 0;
  private frameSeed = 1;
  private destroyed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (gl === null) {
      throw new FlowRendererError(
        "This browser does not support WebGL2, which the flow visualizer needs."
      );
    }
    if (gl.getExtension("EXT_color_buffer_float") === null) {
      throw new FlowRendererError(
        "This GPU does not support float render targets, which the flow visualizer needs."
      );
    }
    this.gl = gl;

    const quadBuffer = gl.createBuffer();
    const framebuffer = gl.createFramebuffer();
    if (quadBuffer === null || framebuffer === null) {
      throw new FlowRendererError("Could not allocate WebGL resources.");
    }
    this.quadBuffer = quadBuffer;
    this.framebuffer = framebuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    this.quadArray = this.createVertexArray(quadBuffer, 2);

    this.fadeProgram = this.createProgram(
      SCREEN_VERTEX_SHADER,
      FADE_FRAGMENT_SHADER
    );
    this.blitProgram = this.createProgram(
      SCREEN_VERTEX_SHADER,
      BLIT_FRAGMENT_SHADER
    );
    this.reprojectProgram = this.createProgram(
      SCREEN_VERTEX_SHADER,
      REPROJECT_FRAGMENT_SHADER
    );
    this.setParticleCount(this.options.particleCount);
  }

  /** Whether the GPU has taken the context away underneath this renderer. */
  get isContextLost() {
    return this.gl.isContextLost();
  }

  /**
   * The current value of every name the field reads.
   *
   * Separate from `setField` on purpose: these change as often as a slider is
   * dragged, and routing them through the field would rebuild both programs on
   * every frame of that drag.
   */
  setParameters(values: ReadonlyMap<string, number>) {
    this.parameters = values;
  }

  setTime(seconds: number) {
    this.time = seconds;
  }

  /**
   * Swaps in a new field. Throws {@link FlowRendererError} if the GLSL will not
   * compile, which is the last line of defence behind the LaTeX compiler.
   */
  setField(field: FlowField) {
    // Same reasoning as ArrowRenderer: an unchanged field is the same object,
    // and comparing that is free where serialising it is not.
    if (this.linkedField === field) return;
    const key = JSON.stringify(field);
    if (this.fieldSource === key) return;
    const updateProgram = this.createProgram(
      QUAD_VERTEX_SHADER,
      updateFragmentShader(field)
    );
    const drawProgram = this.createProgram(
      drawVertexShader(field),
      DRAW_FRAGMENT_SHADER
    );
    this.deleteProgram(this.updateProgram);
    this.deleteProgram(this.drawProgram);
    this.updateProgram = updateProgram;
    this.drawProgram = drawProgram;
    this.linkedField = field;
    this.fieldSource = key;
    this.seedParticles();
  }

  /**
   * Moves the view, carrying the trails with it.
   *
   * The trail texture is in screen space, so a pan or zoom invalidates every
   * pixel in it. Clearing was the obvious answer and the wrong one: Desmos
   * reports bounds on every pointermove, so dragging the graph wiped the trails
   * sixty times a second and the flow blinked out for the whole gesture.
   * Redrawing the old trail into its new place instead costs one screen pass
   * and keeps the motion continuous; whatever pans in from off-screen is
   * transparent and fills in over the next few frames.
   */
  setBounds(bounds: FlowBounds) {
    const previous = this.bounds;
    this.bounds = bounds;
    if (this.trailFront === undefined || this.trailBack === undefined) return;
    this.reprojectTrails(previous, bounds);
  }

  /** Moves the view without carrying anything over, e.g. when starting. */
  resetBounds(bounds: FlowBounds) {
    this.bounds = bounds;
    this.clearTrails();
  }

  private reprojectTrails(from: FlowBounds, to: FlowBounds) {
    const mapping = trailReprojection(from, to);
    if (mapping === undefined) {
      this.clearTrails();
      return;
    }
    const { gl } = this;
    const program = this.reprojectProgram;
    gl.useProgram(program.program);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadArray);
    gl.activeTexture(gl.TEXTURE0);
    // The newest trail is in the back texture between frames, matching the
    // swap at the end of `frame`.
    gl.bindTexture(gl.TEXTURE_2D, this.trailBack!);
    gl.uniform1i(program.uniforms.u_screen, 0);
    gl.uniform2f(program.uniforms.u_scale, mapping.scaleX, mapping.scaleY);
    gl.uniform2f(program.uniforms.u_offset, mapping.offsetX, mapping.offsetY);
    this.bindTrailTarget(this.trailFront!);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [this.trailFront, this.trailBack] = [this.trailBack, this.trailFront];
  }

  setOptions(options: FlowOptions) {
    this.options = { ...options };
    this.setParticleCount(options.particleCount);
  }

  /** Matches the drawing buffer to the CSS box. Returns true if it changed. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number) {
    const width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(cssHeight * devicePixelRatio));
    if (width === this.trailWidth && height === this.trailHeight) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    this.trailWidth = width;
    this.trailHeight = height;
    this.allocateTrails();
    return true;
  }

  /** Clears the trail texture, e.g. after a pan or zoom. */
  clearTrails() {
    const { gl } = this;
    for (const texture of [this.trailFront, this.trailBack]) {
      if (texture === undefined) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      gl.viewport(0, 0, this.trailWidth, this.trailHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  frame() {
    if (
      this.destroyed ||
      this.updateProgram === undefined ||
      this.drawProgram === undefined ||
      this.particleRead === undefined ||
      this.trailFront === undefined ||
      this.trailBack === undefined
    ) {
      return;
    }
    this.frameSeed = (this.frameSeed * 16807) % 2147483647;
    this.stepParticles();
    this.fadeTrails();
    this.drawParticles();
    this.blitToCanvas();
    [this.trailFront, this.trailBack] = [this.trailBack, this.trailFront];
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const { gl } = this;
    this.deleteProgram(this.updateProgram);
    this.deleteProgram(this.drawProgram);
    this.deleteProgram(this.fadeProgram);
    this.deleteProgram(this.blitProgram);
    this.deleteProgram(this.reprojectProgram);
    for (const texture of [
      this.particleRead,
      this.particleWrite,
      this.trailFront,
      this.trailBack,
    ]) {
      if (texture !== undefined) gl.deleteTexture(texture);
    }
    if (this.indexBuffer !== undefined) gl.deleteBuffer(this.indexBuffer);
    if (this.indexArray !== undefined) gl.deleteVertexArray(this.indexArray);
    gl.deleteVertexArray(this.quadArray);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteFramebuffer(this.framebuffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  // ---- internals ---------------------------------------------------------

  /**
   * Rows of the particle texture that the draw pass can reach. The last drawn
   * index is `particleCount - 1`, which the draw shader reads from row
   * `(particleCount - 1) / resolution`.
   */
  private get liveParticleRows() {
    if (this.particleResolution === 0) return 0;
    return Math.min(
      this.particleResolution,
      Math.max(1, Math.ceil(this.particleCount / this.particleResolution))
    );
  }

  private stepParticles() {
    const { gl } = this;
    const program = this.updateProgram!;
    gl.useProgram(program.program);
    uploadFieldParameters(
      gl,
      program.uniforms,
      this.linkedField,
      this.parameters,
      this.time
    );
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadArray);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.particleRead!);
    gl.uniform1i(program.uniforms.u_particles, 0);

    const { xMin, xMax, yMin, yMax } = this.bounds;
    const span = Math.max(xMax - xMin, yMax - yMin);
    gl.uniform2f(program.uniforms.u_min, xMin, yMin);
    gl.uniform2f(program.uniforms.u_max, xMax, yMax);
    gl.uniform1f(
      program.uniforms.u_h,
      this.options.normalizeSpeed
        ? 0.004 * this.options.speed * span
        : 0.01 * this.options.speed
    );
    gl.uniform1f(
      program.uniforms.u_normalize,
      this.options.normalizeSpeed ? 1 : 0
    );
    gl.uniform1f(program.uniforms.u_dropRate, this.options.dropRate);
    gl.uniform1f(program.uniforms.u_seed, this.frameSeed / 2147483647);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.particleWrite!,
      0
    );
    // Only the rows that hold live particles are integrated. Capacity can be up
    // to twice the count, and the texels past it are never drawn, so stepping
    // them would be work nobody sees.
    gl.viewport(0, 0, this.particleResolution, this.liveParticleRows);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    [this.particleRead, this.particleWrite] = [
      this.particleWrite,
      this.particleRead,
    ];
  }

  private fadeTrails() {
    const { gl } = this;
    const program = this.fadeProgram;
    gl.useProgram(program.program);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailBack!);
    gl.uniform1i(program.uniforms.u_screen, 0);
    gl.uniform1f(program.uniforms.u_fade, this.options.trailPersistence);
    this.bindTrailTarget(this.trailFront!);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private drawParticles() {
    const { gl } = this;
    const program = this.drawProgram!;
    gl.useProgram(program.program);
    uploadFieldParameters(
      gl,
      program.uniforms,
      this.linkedField,
      this.parameters,
      this.time
    );
    this.bindTrailTarget(this.trailFront!);
    gl.enable(gl.BLEND);
    // Colors leave the shader premultiplied, which keeps repeated blending
    // into the trail texture from washing out toward white.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.indexArray!);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.particleRead!);
    gl.uniform1i(program.uniforms.u_particles, 0);
    gl.uniform1i(program.uniforms.u_resolution, this.particleResolution);

    const { xMin, xMax, yMin, yMax } = this.bounds;
    gl.uniform2f(program.uniforms.u_min, xMin, yMin);
    gl.uniform2f(program.uniforms.u_max, xMax, yMax);
    gl.uniform1f(
      program.uniforms.u_pointSize,
      Math.max(
        1,
        this.options.pointSize *
          (this.canvas.width / Math.max(1, this.canvas.clientWidth))
      )
    );
    gl.uniform1f(program.uniforms.u_opacity, this.options.opacity);
    gl.uniform1f(program.uniforms.u_glow, this.options.glow);
    gl.uniform1i(
      program.uniforms.u_colorMode,
      colorModeIndex(this.options.colorMode)
    );
    const [r, g, b] = hexToUnitRGB(this.options.fixedColor);
    gl.uniform3f(program.uniforms.u_fixedColor, r, g, b);
    const palette = paletteUniforms(this.options.palette);
    gl.uniform1fv(program.uniforms.u_paletteAt, palette.positions);
    gl.uniform3fv(program.uniforms.u_paletteRGB, palette.colors);
    gl.uniform1i(program.uniforms.u_paletteCount, palette.count);
    gl.uniform1i(
      program.uniforms.u_paletteIsHue,
      this.options.palette === "direction-hue" ? 1 : 0
    );
    gl.uniform1f(
      program.uniforms.u_speedScale,
      Math.max(1e-6, (xMax - xMin) / 3)
    );

    gl.drawArrays(gl.POINTS, 0, this.particleCount);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private blitToCanvas() {
    const { gl } = this;
    const program = this.blitProgram;
    gl.useProgram(program.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.trailWidth, this.trailHeight);
    gl.bindVertexArray(this.quadArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailFront!);
    gl.uniform1i(program.uniforms.u_screen, 0);

    // The backdrop is *cleared* to rather than drawn, so the trails composite
    // over it in one pass. Trail colours are premultiplied, which is what makes
    // `ONE, ONE_MINUS_SRC_ALPHA` the right blend for putting them on top of
    // something rather than on top of nothing.
    const backdrop = this.backdropRGBA;
    if (backdrop === undefined) {
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const [r, g, b, a] = backdrop;
      // Premultiplied, because the canvas is composited over the page the same
      // way the trails are composited over the backdrop.
      gl.clearColor(r * a, g * a, b * a, a);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  /** The backdrop as premultiplication-ready components, or undefined for none. */
  private get backdropRGBA():
    | readonly [number, number, number, number]
    | undefined {
    const { backdrop, backdropOpacity } = this.options;
    if (backdrop === "") return undefined;
    const alpha = Math.min(1, Math.max(0, backdropOpacity));
    if (alpha <= 0) return undefined;
    const [r, g, b] = hexToUnitRGB(backdrop);
    return [r, g, b, alpha];
  }

  private bindTrailTarget(texture: WebGLTexture) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.viewport(0, 0, this.trailWidth, this.trailHeight);
  }

  /**
   * A vertex array holding one float attribute in {@link VERTEX_ATTRIBUTE_SLOT}.
   *
   * The pointer state lives in the object rather than being re-established per
   * draw, which is the whole reason WebGL2 has these.
   */
  private createVertexArray(buffer: WebGLBuffer, size: number) {
    const { gl } = this;
    const array = gl.createVertexArray();
    if (array === null)
      throw new FlowRendererError("Could not allocate a vertex array.");
    gl.bindVertexArray(array);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(VERTEX_ATTRIBUTE_SLOT);
    gl.vertexAttribPointer(VERTEX_ATTRIBUTE_SLOT, size, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return array;
  }

  /**
   * Points the renderer at a new particle count, reallocating only when the
   * count no longer fits the current capacity — or has fallen far enough below
   * it to be worth giving the memory back.
   */
  private setParticleCount(count: number) {
    const wanted = Math.max(1, Math.round(count));
    if (wanted === this.particleCount) return;
    const outgrown = wanted > this.particleCapacity;
    // Only shrink once the capacity is mostly idle, so a count hovering around
    // a power of two cannot reallocate on every step.
    const oversized =
      wanted * 4 <= this.particleCapacity &&
      particleCapacityFor(wanted) < this.particleCapacity;
    if (outgrown || oversized) this.allocateParticles(wanted);
    else this.particleCount = wanted;
  }

  /**
   * Particle state lives in the smallest square texture that holds the current
   * capacity. Only `particleCount` points are advanced and drawn, so the
   * leftover texels are simply never read and the user gets the exact count
   * they asked for rather than the nearest square.
   */
  private allocateParticles(count: number) {
    const { gl } = this;
    if (this.particleRead !== undefined) gl.deleteTexture(this.particleRead);
    if (this.particleWrite !== undefined) gl.deleteTexture(this.particleWrite);
    if (this.indexBuffer !== undefined) gl.deleteBuffer(this.indexBuffer);
    if (this.indexArray !== undefined) gl.deleteVertexArray(this.indexArray);
    const capacity = particleCapacityFor(count);
    const resolution = particleResolutionFor(capacity);
    this.particleCapacity = capacity;
    this.particleResolution = resolution;
    this.particleCount = count;

    const indices = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) indices[i] = i;
    const indexBuffer = gl.createBuffer();
    if (indexBuffer === null)
      throw new FlowRendererError("Could not allocate particles.");
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.indexBuffer = indexBuffer;
    this.indexArray = this.createVertexArray(indexBuffer, 1);

    this.particleRead = this.createFloatTexture(resolution);
    this.particleWrite = this.createFloatTexture(resolution);
    this.seedParticles();
  }

  private seedParticles() {
    const { gl } = this;
    if (this.particleRead === undefined || this.particleResolution === 0)
      return;
    const resolution = this.particleResolution;
    const data = new Float32Array(resolution * resolution * 4);
    const { xMin, xMax, yMin, yMax } = this.bounds;
    for (let i = 0; i < resolution * resolution; i++) {
      data[i * 4] = xMin + Math.random() * (xMax - xMin);
      data[i * 4 + 1] = yMin + Math.random() * (yMax - yMin);
      // Stagger initial ages so the whole field does not respawn in lockstep.
      data[i * 4 + 2] = Math.random() * MAX_PARTICLE_AGE;
      data[i * 4 + 3] = Math.random();
    }
    for (const texture of [this.particleRead, this.particleWrite]) {
      gl.bindTexture(gl.TEXTURE_2D, texture!);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        resolution,
        resolution,
        0,
        gl.RGBA,
        gl.FLOAT,
        data
      );
    }
  }

  private allocateTrails() {
    const { gl } = this;
    if (this.trailFront !== undefined) gl.deleteTexture(this.trailFront);
    if (this.trailBack !== undefined) gl.deleteTexture(this.trailBack);
    this.trailFront = this.createByteTexture(this.trailWidth, this.trailHeight);
    this.trailBack = this.createByteTexture(this.trailWidth, this.trailHeight);
    this.clearTrails();
  }

  private createFloatTexture(resolution: number) {
    const { gl } = this;
    const texture = gl.createTexture();
    if (texture === null)
      throw new FlowRendererError("Could not allocate a texture.");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      resolution,
      resolution,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    );
    return texture;
  }

  /**
   * A trail texture. Filtered linearly, unlike the particle state, because
   * reprojecting it across a zoom samples between texels; the fade and blit
   * passes read it one-to-one, where linear filtering lands on texel centres
   * and returns exactly what nearest would.
   */
  private createByteTexture(width: number, height: number) {
    const { gl } = this;
    const texture = gl.createTexture();
    if (texture === null)
      throw new FlowRendererError("Could not allocate a texture.");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    return texture;
  }

  private createProgram(
    vertexSource: string,
    fragmentSource: string
  ): ProgramInfo {
    const { gl } = this;
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (program === null)
      throw new FlowRendererError("Could not create a shader program.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    // Naming a slot for both attributes is harmless in a program that declares
    // only one of them, and it is what makes the shared vertex arrays valid.
    gl.bindAttribLocation(program, VERTEX_ATTRIBUTE_SLOT, "a_pos");
    gl.bindAttribLocation(program, VERTEX_ATTRIBUTE_SLOT, "a_index");
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      const log = gl.getProgramInfoLog(program) ?? "";
      gl.deleteProgram(program);
      throw new FlowRendererError(
        `Could not link the flow shader. ${log}`.trim()
      );
    }
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info === null) continue;
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
      // An array uniform is reported as `u_name[0]`, but every call site names
      // it without the index, so it is stored under both.
      const array = /^(.*)\[0\]$/.exec(info.name);
      if (array !== null) uniforms[array[1]] = uniforms[info.name];
    }
    return { program, uniforms };
  }

  private compileShader(type: number, source: string) {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (shader === null)
      throw new FlowRendererError("Could not create a shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new FlowRendererError(
        `This field could not be compiled for the GPU. ${log}`.trim()
      );
    }
    return shader;
  }

  private deleteProgram(program: ProgramInfo | undefined) {
    if (program !== undefined) this.gl.deleteProgram(program.program);
  }
}

const MAX_PARTICLE_AGE = 400;

function colorModeIndex(mode: FlowColorMode) {
  return mode === "fixed" ? 0 : mode === "speed" ? 1 : 2;
}

export function hexToUnitRGB(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3 ? [...value].map((char) => char + char).join("") : value;
  const parsed = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(parsed)) return [0.4, 0.3, 0.7];
  return [
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255,
  ];
}

// ---- shader sources ------------------------------------------------------

const QUAD_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
void main() { gl_Position = vec4(2.0 * a_pos - 1.0, 0.0, 1.0); }
`;

const SCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(2.0 * a_pos - 1.0, 0.0, 1.0);
}
`;

const FADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_screen;
uniform float u_fade;
in vec2 v_uv;
out vec4 outColor;
void main() {
  // Quantising down keeps the trail from stalling on a non-zero byte value
  // and leaving permanent smudges.
  vec4 color = texture(u_screen, v_uv) * u_fade;
  outColor = floor(color * 255.0) / 255.0;
}
`;

const BLIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_screen;
in vec2 v_uv;
out vec4 outColor;
void main() { outColor = texture(u_screen, v_uv); }
`;

/**
 * Redraws the trail texture under a new view.
 *
 * Sampling outside the old view has to come out transparent rather than
 * clamped: the edge texel would otherwise smear across everything that panned
 * in from off-screen.
 */
const REPROJECT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_screen;
uniform vec2 u_scale;
uniform vec2 u_offset;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec2 uv = u_offset + v_uv * u_scale;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    outColor = vec4(0.0);
    return;
  }
  outColor = texture(u_screen, uv);
}
`;

function updateFragmentShader(field: FlowField) {
  return `#version 300 es
precision highp float;
uniform sampler2D u_particles;
uniform vec2 u_min;
uniform vec2 u_max;
uniform float u_h;
uniform float u_seed;
uniform float u_dropRate;
uniform float u_normalize;
out vec4 outState;

${fieldFunctions(field)}

float vtRand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 vtVelocity(vec2 p) {
  vec2 v = vtField(p);
  float m = length(v);
  return mix(v, v / max(m, 1e-9), u_normalize);
}

vec2 vtStep(vec2 p) {
  vec2 k1 = vtVelocity(p);
  vec2 k2 = vtVelocity(p + k1 * u_h * 0.5);
  vec2 k3 = vtVelocity(p + k2 * u_h * 0.5);
  vec2 k4 = vtVelocity(p + k3 * u_h);
  return (k1 + 2.0 * k2 + 2.0 * k3 + k4) * u_h / 6.0;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec4 state = texelFetch(u_particles, texel, 0);
  vec2 pos = state.xy;
  float age = state.z;

  vec2 span = u_max - u_min;
  vec2 seed = (pos + gl_FragCoord.xy) * (u_seed + 0.31);
  vec2 respawn = vec2(vtRand(seed + 1.9), vtRand(seed + 8.4)) * span + u_min;

  vec2 delta = vtStep(pos);
  vec2 next = pos + delta;

  bool escaped = any(lessThan(next, u_min - 0.05 * span)) ||
                 any(greaterThan(next, u_max + 0.05 * span));
  bool stalled = length(delta) < 1e-9 * max(span.x, span.y);
  bool expired = age > ${MAX_PARTICLE_AGE}.0 || vtRand(seed) < u_dropRate;
  bool broken = isnan(next.x) || isnan(next.y) || isinf(next.x) || isinf(next.y);

  if (escaped || stalled || expired || broken) {
    next = respawn;
    age = 0.0;
  } else {
    age += 1.0;
  }
  outState = vec4(next, age, state.w);
}
`;
}

function drawVertexShader(field: FlowField) {
  return `#version 300 es
precision highp float;
in float a_index;
uniform sampler2D u_particles;
uniform int u_resolution;
uniform vec2 u_min;
uniform vec2 u_max;
uniform float u_pointSize;
uniform float u_glow;
uniform float u_opacity;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform float u_speedScale;
out vec4 v_color;

${fieldFunctions(field)}
${PALETTE_GLSL}

void main() {
  int index = int(a_index);
  ivec2 texel = ivec2(index % u_resolution, index / u_resolution);
  vec4 state = texelFetch(u_particles, texel, 0);

  vec2 normalized = (state.xy - u_min) / (u_max - u_min);
  gl_Position = vec4(2.0 * normalized - 1.0, 0.0, 1.0);
  // The sprite grows so the halo has somewhere to go. The core keeps its own
  // size by shrinking in sprite coordinates, so raising the glow softens a
  // particle without also making it look bigger.
  gl_PointSize = u_pointSize * (1.0 + ${glslFloat(GLOW_SPREAD)} * u_glow);

  vec2 v = vtField(state.xy);
  vec3 rgb = u_fixedColor;
  if (u_colorMode == 1) {
    // A ramp that saturates rather than one stretched between two measured
    // ends. Nothing has to be reduced to find the field's range — and, which
    // matters more, nothing can take the range over. A field with a pole in it
    // reaches magnitudes larger than the rest of it put together, and a ramp
    // spread to one of those leaves every ordinary particle at the bottom of
    // it. This one gives the ordinary values most of the ramp and lets the
    // poles run into its end.
    rgb = vtPalette(1.0 - exp(-length(v) / u_speedScale));
  } else if (u_colorMode == 2) {
    rgb = vtHueRamp(fract(atan(v.y, v.x) / 6.2831853 + 1.0));
  }

  // Ease particles in and out so respawns do not pop.
  float fade = min(1.0, state.z / 10.0) *
               min(1.0, (${MAX_PARTICLE_AGE}.0 - state.z) / 40.0);
  float alpha = clamp(u_opacity * fade, 0.0, 1.0);
  v_color = vec4(rgb * alpha, alpha);
}
`;
}

/**
 * How much wider a fully glowing particle's sprite is than a bare one.
 *
 * Capped, because the cost of the glow is the area drawn per particle and area
 * goes as the square of this. At 1.5 a glowing particle costs about six times
 * the fill of a bare one, which a mid-range GPU absorbs at the particle counts
 * this visualizer actually runs at.
 */
const GLOW_SPREAD = 1.5;

/**
 * A number as a GLSL float literal.
 *
 * `${2}` interpolates as `2`, which GLSL rejects where a float is wanted, and
 * the failure is a shader that does not compile rather than one that looks
 * wrong — so it has to be right for every value the constant could take, not
 * just the one it has.
 */
function glslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

const DRAW_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
uniform float u_glow;
out vec4 outColor;
void main() {
  // Distance from the sprite's centre, 0 at the middle and 1 at its edge.
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float spread = 1.0 + ${glslFloat(GLOW_SPREAD)} * u_glow;
  // The core is the particle as it has always been drawn, kept the same size
  // on screen while the sprite around it grows.
  float core = 1.0 - smoothstep(0.7 / spread, 1.0 / spread, d);
  float halo = exp(-2.5 * d * d);
  float mask = clamp(core + u_glow * halo, 0.0, 1.0);
  outColor = v_color * mask;
}
`;
