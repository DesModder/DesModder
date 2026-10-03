/**
 * The fluid on the graph: a canvas under Desmos's own, holding the lattice and
 * drawing it where the tank is.
 *
 * The lattice lives in this canvas's WebGL context because a texture cannot
 * be shared between contexts, and drawing it means reading its textures every
 * frame. The display pass maps each screen pixel through the graph's viewport
 * into the tank, which is fixed in graph coordinates (brief §8.0). It colours
 * fluid cells by what the tab asks to see and leaves solids clear, so that
 * Desmos's own shading of each inequality is what marks a solid. Panning and
 * zooming move the picture without disturbing the flow.
 *
 * The canvas never takes pointer events and sits at the bottom of the graph's
 * stack, under the axes, the expressions and Vector Tools' own overlays.
 */

import type { Calc } from "#globals";
import type { Boundaries } from "./lbm/boundaries";
import { GpuD2Q9, type Sponge } from "./lbm/GpuD2Q9";

const GRAPH_CANVAS_SELECTOR = "canvas.dcg-graph-inner";
const CANVAS_ID = "dsm-vector-tools-fluid-canvas";

export type FluidShow = "vorticity" | "speed" | "pressure";

/** Everything that defines a lattice; a change to any of it is a new one. */
export interface LatticeSpec {
  nx: number;
  ny: number;
  tau: number;
  smagorinsky: number;
  boundaries: Boundaries;
  solid: Uint8Array;
  links: Float32Array;
  inletUx: number[];
  inletUy: number[];
  sponge: Sponge | undefined;
  /** The velocity the tank starts at, everywhere outside the solids. */
  initial: readonly [number, number];
  /** A force density per cell (`2k`, `2k + 1`), or undefined for none. */
  forceField: Float32Array | undefined;
}

export interface Tank {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Two passes. The first computes what is shown once per cell, at the
 * lattice's own resolution, into a half-float texture: vorticity is
 * ∂v/∂x − ∂u/∂y by central differences, speed is |u|, pressure is δρ. The
 * second runs per screen pixel and only samples that texture, with the
 * hardware's bilinear filter (half floats filter in WebGL2 without an
 * extension). Computing vorticity per pixel instead read twenty texels for
 * each, and on a software renderer (SwiftShader) that alone made every
 * frame a stall.
 */
const VALUE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D u_macro;
uniform ivec2 u_size;
uniform int u_show;
uniform float u_scale;
out vec4 outColor;

vec4 macroAt(ivec2 p) {
  return texelFetch(u_macro, clamp(p, ivec2(0), u_size - 1), 0);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 m = macroAt(c);
  float v;
  if (u_show == 0) {
    v = (macroAt(c + ivec2(1, 0)).w - macroAt(c - ivec2(1, 0)).w) * 0.5
      - (macroAt(c + ivec2(0, 1)).z - macroAt(c - ivec2(0, 1)).z) * 0.5;
  } else if (u_show == 1) {
    v = length(m.zw);
  } else {
    v = m.y;
  }
  outColor = vec4(v / u_scale, 0.0, 0.0, 1.0);
}`;

const DISPLAY = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D u_value;
uniform sampler2D u_solid;
uniform ivec2 u_size;
uniform vec4 u_view;
uniform vec4 u_tank;
uniform vec2 u_canvas;
uniform int u_show;
uniform float u_opacity;
out vec4 outColor;

// A diverging ramp for signed fields: blue, white, red.
vec3 diverging(float v) {
  v = clamp(v, -1.0, 1.0);
  vec3 cold = vec3(0.16, 0.38, 0.85);
  vec3 hot = vec3(0.84, 0.19, 0.17);
  return v < 0.0 ? mix(vec3(1.0), cold, -v) : mix(vec3(1.0), hot, v);
}
// A sequential ramp for speed: deep blue to yellow.
vec3 sequential(float v) {
  v = clamp(v, 0.0, 1.0);
  vec3 a = vec3(0.10, 0.14, 0.45);
  vec3 b = vec3(0.13, 0.62, 0.72);
  vec3 c = vec3(0.98, 0.90, 0.30);
  return v < 0.5 ? mix(a, b, v * 2.0) : mix(b, c, v * 2.0 - 1.0);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) / u_canvas;
  vec2 graph = vec2(
    mix(u_view.x, u_view.y, screen.x),
    mix(u_view.w, u_view.z, screen.y)
  );
  vec2 uv = (graph - u_tank.xz) / (u_tank.yw - u_tank.xz);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
  ivec2 cell = clamp(ivec2(uv * vec2(u_size)), ivec2(0), u_size - 1);
  if (texelFetch(u_solid, cell, 0).r > 0.0) discard;
  float v = texture(u_value, uv).r;
  vec3 colour = u_show == 1 ? sequential(v) : diverging(v);
  outColor = vec4(colour * u_opacity, u_opacity);
}`;

export class FluidOverlay {
  private canvas?: HTMLCanvasElement;
  private gl?: WebGL2RenderingContext;
  private display?: WebGLProgram;
  private valueProgram?: WebGLProgram;
  private valueTexture?: WebGLTexture;
  private valueFramebuffer?: WebGLFramebuffer;
  private valueSize: [number, number] = [0, 0];
  private lattice?: GpuD2Q9;
  private resizeObserver?: ResizeObserver;
  private contextLost = false;
  private solidTexture?: WebGLTexture;

  constructor(
    private readonly calc: Calc,
    private readonly onError: (message: string) => void
  ) {}

  get isRunning() {
    return this.lattice !== undefined;
  }

  get steps() {
    return this.lattice?.steps ?? 0;
  }

  /** The lattice itself, for stepping and measuring. */
  get current(): GpuD2Q9 | undefined {
    return this.lattice;
  }

  /** Builds a lattice from `spec`, at rest, replacing any there was. */
  start(spec: LatticeSpec) {
    try {
      if (this.gl === undefined || this.contextLost) this.mount();
      const gl = this.gl!;
      this.lattice?.dispose();
      const lattice = new GpuD2Q9(gl, {
        nx: spec.nx,
        ny: spec.ny,
        tau: spec.tau,
      });
      lattice.smagorinsky = spec.smagorinsky;
      lattice.setBoundaries(spec.boundaries);
      lattice.setInlet(spec.inletUx, spec.inletUy);
      lattice.setSponge(spec.sponge);
      lattice.setSolid(spec.solid);
      lattice.setLinks(spec.links);
      lattice.setForceField(spec.forceField);
      const [ux, uy] = spec.initial;
      lattice.initialize((x, y) =>
        spec.solid[y * spec.nx + x] ? { ux: 0, uy: 0 } : { ux, uy }
      );
      lattice.inletScale = 0;
      this.lattice = lattice;
      this.uploadSolid(spec);
    } catch (error) {
      this.stop();
      this.onError(
        error instanceof Error ? error.message : "The fluid could not start."
      );
    }
  }

  /**
   * New solids for the running lattice, without restarting it: a resized or
   * moved obstacle. Cells it uncovers keep the populations they were frozen
   * with, which is why the tab marks the flow near them as settling.
   */
  updateSolids(solid: Uint8Array, links: Float32Array, spec: LatticeSpec) {
    if (this.lattice === undefined) return;
    this.lattice.setSolid(solid);
    this.lattice.setLinks(links);
    this.uploadSolid({ ...spec, solid });
  }

  /** A new force field for the running lattice: a slider moved P or Q. */
  updateForceField(field: Float32Array | undefined) {
    this.lattice?.setForceField(field);
  }

  /** Draws the current state over the tank, for the graph's current view. */
  draw(tank: Tank, show: FluidShow, scale: number, opacity = 0.85) {
    const { gl, canvas, lattice, display, valueProgram } = this;
    if (!gl || !canvas || !lattice || !display || !valueProgram) return;
    if (this.contextLost) return;
    this.resize();
    this.ensureValueTarget(lattice.nx, lattice.ny);
    const showCode = show === "vorticity" ? 0 : show === "speed" ? 1 : 2;

    // The value at each cell.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.valueFramebuffer!);
    gl.viewport(0, 0, lattice.nx, lattice.ny);
    gl.disable(gl.BLEND);
    gl.useProgram(valueProgram);
    const v = (name: string) => gl.getUniformLocation(valueProgram, name);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lattice.textures[2]);
    gl.uniform1i(v("u_macro"), 0);
    gl.uniform2i(v("u_size"), lattice.nx, lattice.ny);
    gl.uniform1i(v("u_show"), showCode);
    gl.uniform1f(v("u_scale"), scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The screen.
    const math = this.calc.graphpaperBounds.mathCoordinates;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(display);
    const at = (name: string) => gl.getUniformLocation(display, name);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.valueTexture!);
    gl.uniform1i(at("u_value"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.solidTexture!);
    gl.uniform1i(at("u_solid"), 1);
    gl.uniform2i(at("u_size"), lattice.nx, lattice.ny);
    gl.uniform4f(at("u_view"), math.left, math.right, math.bottom, math.top);
    gl.uniform4f(at("u_tank"), tank.xMin, tank.xMax, tank.yMin, tank.yMax);
    gl.uniform2f(at("u_canvas"), canvas.width, canvas.height);
    gl.uniform1i(at("u_show"), showCode);
    gl.uniform1f(at("u_opacity"), opacity);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  /** The half-float texture the value pass writes, sized to the lattice. */
  private ensureValueTarget(nx: number, ny: number) {
    const { gl } = this;
    if (!gl) return;
    const [width, height] = this.valueSize;
    if (this.valueTexture && width === nx && height === ny) return;
    if (this.valueTexture) gl.deleteTexture(this.valueTexture);
    if (this.valueFramebuffer) gl.deleteFramebuffer(this.valueFramebuffer);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, nx, ny);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.valueTexture = texture;
    this.valueFramebuffer = framebuffer;
    this.valueSize = [nx, ny];
  }

  stop() {
    this.lattice?.dispose();
    this.lattice = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.gl && this.display) this.gl.deleteProgram(this.display);
    if (this.gl && this.valueProgram) this.gl.deleteProgram(this.valueProgram);
    if (this.gl && this.valueTexture) this.gl.deleteTexture(this.valueTexture);
    if (this.gl && this.valueFramebuffer)
      this.gl.deleteFramebuffer(this.valueFramebuffer);
    this.valueProgram = undefined;
    this.valueTexture = undefined;
    this.valueFramebuffer = undefined;
    this.valueSize = [0, 0];
    if (this.gl && this.solidTexture) this.gl.deleteTexture(this.solidTexture);
    this.display = undefined;
    this.solidTexture = undefined;
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = undefined;
    this.canvas?.remove();
    this.canvas = undefined;
    this.contextLost = false;
  }

  /**
   * A copy of the solid mask for the display, which reads it to leave solids
   * clear. The lattice's own copy is in its context too, but private to it.
   */
  private uploadSolid(spec: Pick<LatticeSpec, "nx" | "ny" | "solid">) {
    const { gl } = this;
    if (!gl) return;
    if (this.solidTexture) gl.deleteTexture(this.solidTexture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, spec.nx, spec.ny);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      spec.nx,
      spec.ny,
      gl.RED,
      gl.UNSIGNED_BYTE,
      spec.solid
    );
    this.solidTexture = texture;
  }

  private mount() {
    this.stop();
    const graphCanvas = document.querySelector(GRAPH_CANVAS_SELECTOR);
    const parent = graphCanvas?.parentElement;
    if (graphCanvas == null || parent == null) {
      throw new Error("Could not find the Desmos graph paper to draw on.");
    }
    document.getElementById(CANVAS_ID)?.remove();
    const canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
    // At the very bottom of the stack, under the graph and both of Vector
    // Tools' own overlays, so particles and arrows draw over the fluid. The
    // mark is what keeps the flow overlay, which also wants the bottom, from
    // putting its particles underneath this.
    canvas.dataset.dsmFloor = "";
    parent.insertBefore(canvas, parent.firstChild);
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: true,
    });
    if (gl === null) throw new Error("This browser has no WebGL2.");
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.lattice = undefined;
      this.onError(
        "The browser took the graphics context away from the fluid. Restart it from the Fluid tab."
      );
    });
    this.canvas = canvas;
    this.gl = gl;
    this.display = link(gl, VERTEX, DISPLAY);
    this.valueProgram = link(gl, VERTEX, VALUE);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(parent);
    this.resize();
  }

  private resize() {
    const { canvas } = this;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(`Fluid display shader: ${gl.getShaderInfoLog(shader)}`);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(`Fluid display shader: ${gl.getProgramInfoLog(program)}`);
  return program;
}
