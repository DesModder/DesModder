/**
 * Draws the audio field.
 *
 * Particle positions live in a floating-point texture and are stepped on the
 * GPU, so nothing about a particle crosses back to the CPU. What crosses each
 * frame is nine floats — the audio features — as uniforms.
 *
 * That distinction is the whole performance argument. Audio changes constantly;
 * the shape of the field does not. A preset compiles its two programs once, and
 * every subsequent frame of music sets uniforms on the programs that are
 * already there. A renderer that rebuilt a program because a band got louder
 * would spend more time compiling than drawing.
 */
import {
  QUALITY_LADDER,
  nextQualityLevel,
  presetById,
  type PresetId,
} from "./presets";
import {
  DRAW_FRAGMENT,
  QUAD_VERTEX_SHADER,
  SEED_FRAGMENT,
  drawVertexShader,
  updateFragmentShader,
} from "./shaders";
import type { AudioFeatureFrame } from "../audio/features";

export class AudioFieldError extends Error {}

export interface FieldBounds {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** How long a particle lives before it is respawned somewhere else. */
const LIFETIME_SECONDS = 3.5;
/**
 * A frame longer than this is a tab that was hidden or a machine that stalled.
 * Integrating it would jump every particle across the screen at once.
 */
const MAX_DELTA_S = 1 / 20;

interface Programs {
  readonly update: WebGLProgram;
  readonly draw: WebGLProgram;
}

export class AudioFieldRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly quad: WebGLBuffer;
  private readonly quadArray: WebGLVertexArrayObject;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly emptyArray: WebGLVertexArrayObject;
  private readonly seedProgram: WebGLProgram;
  /**
   * One pair of programs per preset, compiled on first use and kept.
   *
   * Switching back to a preset you have already seen costs nothing, and no
   * ordinary audio frame ever compiles anything. `linkCount` exists so a test
   * can assert that rather than take it on trust.
   */
  private readonly programs = new Map<PresetId, Programs>();

  private read?: WebGLTexture;
  private write?: WebGLTexture;
  private resolution = 0;
  private particles = 0;

  private preset: PresetId = "pulse";
  private bounds: FieldBounds = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };
  private qualityLevel = 0;
  private frameSeed = 1;
  private destroyed = false;
  private linkCount = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      // The field is composited over graph paper every frame, so there is
      // nothing worth preserving between them.
      preserveDrawingBuffer: false,
    });
    if (gl === null)
      throw new AudioFieldError(
        "This browser did not provide WebGL2, so the audio field cannot run. The live graph still works."
      );
    this.gl = gl;

    // Rendering to a float texture is the one non-negotiable extension: the
    // particle state is positions, and eight bits per channel would quantise
    // them onto a visible grid.
    if (gl.getExtension("EXT_color_buffer_float") === null)
      throw new AudioFieldError(
        "This browser cannot render to floating-point textures, which the audio field needs to store particle positions."
      );

    this.quad = this.must(gl.createBuffer(), "vertex buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    this.quadArray = this.must(gl.createVertexArray(), "vertex array");
    gl.bindVertexArray(this.quadArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // The draw pass reads positions by vertex id and has no attributes at all,
    // but WebGL2 still requires some vertex array to be bound.
    this.emptyArray = this.must(gl.createVertexArray(), "vertex array");
    this.framebuffer = this.must(gl.createFramebuffer(), "framebuffer");
    this.seedProgram = this.link(QUAD_VERTEX_SHADER, SEED_FRAGMENT);
    this.allocate(QUALITY_LADDER[0].particles);
  }

  /** How many programs have been linked. Instrumentation for the frame test. */
  get programsLinked() {
    return this.linkCount;
  }

  get particleCount() {
    return this.particles;
  }

  get quality() {
    return QUALITY_LADDER[this.qualityLevel];
  }

  get isContextLost() {
    return this.gl.isContextLost();
  }

  /**
   * Switches presets, compiling that preset's programs the first time it is
   * asked for and reusing them ever after.
   */
  setPreset(id: PresetId) {
    this.preset = id;
    this.ensurePrograms(id);
  }

  setBounds(bounds: FieldBounds) {
    this.bounds = bounds;
  }

  /**
   * Sizes the drawing buffer.
   *
   * Returns whether anything changed, so a caller does not reseed a field that
   * is exactly the size it already was.
   */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number) {
    const scale = devicePixelRatio * this.quality.renderScale;
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));
    if (this.canvas.width === width && this.canvas.height === height)
      return false;
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  /**
   * Steps and draws one frame.
   *
   * `deltaSeconds` is the real elapsed time from the animation frame's own
   * timestamp, clamped, so the field moves at the same speed on a 60 Hz and a
   * 144 Hz display and does not lurch when a tab comes back.
   */
  frame(features: AudioFeatureFrame, deltaSeconds: number) {
    if (this.destroyed || this.gl.isContextLost()) return;
    const dt = Math.min(Math.max(deltaSeconds, 0), MAX_DELTA_S);
    const programs = this.ensurePrograms(this.preset);
    this.frameSeed = (this.frameSeed * 1.618_034 + 0.371) % 1000;

    this.step(programs.update, features, dt);
    this.draw(programs.draw, features);
  }

  /**
   * Reports a frame's cost and adjusts quality if it has to.
   *
   * Returns whether the level moved, because that is the caller's cue to resize
   * the drawing buffer and reseed.
   */
  recordFrameTime(frameMs: number) {
    const next = nextQualityLevel(this.qualityLevel, frameMs);
    if (next === this.qualityLevel) return false;
    this.qualityLevel = next;
    this.allocate(this.quality.particles);
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const { gl } = this;
    for (const texture of [this.read, this.write])
      if (texture !== undefined) gl.deleteTexture(texture);
    for (const { update, draw } of this.programs.values()) {
      gl.deleteProgram(update);
      gl.deleteProgram(draw);
    }
    this.programs.clear();
    gl.deleteProgram(this.seedProgram);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.quad);
    gl.deleteVertexArray(this.quadArray);
    gl.deleteVertexArray(this.emptyArray);
    this.read = undefined;
    this.write = undefined;
  }

  /**
   * Allocates the particle textures for a given count.
   *
   * Particles are stored on a square texture, so the count is rounded up to a
   * square and the surplus simply never drawn — a rectangle whose height
   * depends on the count would reallocate on every quality change.
   */
  private allocate(count: number) {
    const { gl } = this;
    const resolution = Math.max(2, Math.ceil(Math.sqrt(count)));
    this.particles = count;
    if (resolution === this.resolution) {
      this.seed();
      return;
    }
    this.resolution = resolution;
    for (const texture of [this.read, this.write])
      if (texture !== undefined) gl.deleteTexture(texture);
    this.read = this.createStateTexture(resolution);
    this.write = this.createStateTexture(resolution);
    this.seed();
  }

  private createStateTexture(resolution: number) {
    const { gl } = this;
    const texture = this.must(gl.createTexture(), "particle texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
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
    // NEAREST and CLAMP because this texture is a data array that happens to be
    // addressed in two dimensions; interpolating between two particles would
    // produce a position belonging to neither.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  /** Scatters every particle across the current bounds. */
  private seed() {
    const { gl } = this;
    if (this.write === undefined || this.read === undefined) return;
    gl.useProgram(this.seedProgram);
    this.uploadBounds(this.seedProgram);
    gl.uniform1f(
      gl.getUniformLocation(this.seedProgram, "uLifetime"),
      LIFETIME_SECONDS
    );
    gl.uniform1f(
      gl.getUniformLocation(this.seedProgram, "uFrameSeed"),
      this.frameSeed
    );
    for (const target of [this.write, this.read]) {
      this.renderToTexture(target);
      gl.bindVertexArray(this.quadArray);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  private step(program: WebGLProgram, features: AudioFeatureFrame, dt: number) {
    const { gl } = this;
    if (this.read === undefined || this.write === undefined) return;
    gl.useProgram(program);
    this.uploadFeatures(program, features);
    this.uploadBounds(program);
    gl.uniform1f(gl.getUniformLocation(program, "uDeltaTime"), dt);
    gl.uniform1f(gl.getUniformLocation(program, "uLifetime"), LIFETIME_SECONDS);
    gl.uniform1f(gl.getUniformLocation(program, "uFrameSeed"), this.frameSeed);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.read);
    gl.uniform1i(gl.getUniformLocation(program, "uParticles"), 0);

    this.renderToTexture(this.write);
    gl.bindVertexArray(this.quadArray);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);

    // Ping-pong: what was just written becomes what the next frame reads.
    const previous = this.read;
    this.read = this.write;
    this.write = previous;
  }

  private draw(program: WebGLProgram, features: AudioFeatureFrame) {
    const { gl } = this;
    if (this.read === undefined) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Ordinary alpha blending, not additive. Additive can only brighten what
    // is underneath, and Desmos graph paper is white by default, so an additive
    // field over it is invisible however many particles are in it.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(program);
    this.uploadFeatures(program, features);
    this.uploadBounds(program);
    gl.uniform1i(
      gl.getUniformLocation(program, "uResolution"),
      this.resolution
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uPointSize"),
      // Bigger points when there are fewer of them, so a quality drop reads as
      // slightly coarser rather than as a field that suddenly emptied.
      this.quality.particles >= 8000 ? 4 : 5.5
    );
    gl.uniform1f(gl.getUniformLocation(program, "uLifetime"), LIFETIME_SECONDS);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.read);
    gl.uniform1i(gl.getUniformLocation(program, "uParticles"), 0);

    gl.bindVertexArray(this.emptyArray);
    gl.drawArrays(gl.POINTS, 0, this.particles);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  private renderToTexture(texture: WebGLTexture) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.viewport(0, 0, this.resolution, this.resolution);
  }

  /**
   * The nine audio numbers, and nothing else.
   *
   * Non-finite values are replaced rather than passed through: a NaN uniform
   * propagates into every particle position in one frame, and the field never
   * recovers because NaN survives every arithmetic operation applied to it.
   */
  private uploadFeatures(program: WebGLProgram, features: AudioFeatureFrame) {
    const { gl } = this;
    const safe = (value: number, fallback = 0) =>
      Number.isFinite(value) ? value : fallback;
    const set = (name: string, value: number) => {
      gl.uniform1f(gl.getUniformLocation(program, name), safe(value));
    };
    set("uTime", features.time);
    set("uRms", features.rms);
    set("uBass", features.bass);
    set("uMid", features.mid);
    set("uTreble", features.treble);
    set("uCentroid", features.centroid);
    set("uOnset", features.onset);
    set("uBeatPhase", features.beatPhase);
    // Log-normalised across the audible range, because pitch is logarithmic and
    // a linear mapping would leave every note in the bottom of the range.
    const hz = safe(features.dominantHz, 0);
    const normalised =
      hz <= 20 ? 0 : Math.min(1, Math.log2(hz / 20) / Math.log2(20000 / 20));
    gl.uniform1f(gl.getUniformLocation(program, "uDominant"), normalised);
  }

  private uploadBounds(program: WebGLProgram) {
    const { gl } = this;
    const { xMin, xMax, yMin, yMax } = this.bounds;
    gl.uniform4f(
      gl.getUniformLocation(program, "uBounds"),
      xMin,
      xMax,
      yMin,
      yMax
    );
  }

  private ensurePrograms(id: PresetId) {
    const existing = this.programs.get(id);
    if (existing !== undefined) return existing;
    const preset = presetById(id);
    const programs: Programs = {
      update: this.link(QUAD_VERTEX_SHADER, updateFragmentShader(preset)),
      draw: this.link(drawVertexShader(preset), DRAW_FRAGMENT),
    };
    this.programs.set(id, programs);
    return programs;
  }

  private link(vertexSource: string, fragmentSource: string) {
    const { gl } = this;
    const program = this.must(gl.createProgram(), "program");
    const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    this.linkCount++;
    // Shaders are reference-counted by the program; deleting them here means
    // they go the moment the program does.
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
      const log = gl.getProgramInfoLog(program) ?? "";
      gl.deleteProgram(program);
      throw new AudioFieldError(`The audio field shader did not link. ${log}`);
    }
    return program;
  }

  private compile(type: number, source: string) {
    const { gl } = this;
    const shader = this.must(gl.createShader(type), "shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new AudioFieldError(
        `The audio field shader did not compile. ${log}`
      );
    }
    return shader;
  }

  private must<T>(value: T | null, what: string): T {
    if (value === null)
      throw new AudioFieldError(`The audio field could not create a ${what}.`);
    return value;
  }
}
