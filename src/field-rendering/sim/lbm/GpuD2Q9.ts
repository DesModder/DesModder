/**
 * The D2Q9 lattice on the GPU: one fragment pass per step, which pulls each
 * cell's nine populations from its neighbours, rebuilds any it cannot pull,
 * and collides them.
 *
 * It is the CPU reference (`d2q9.ts`, `boundaries.ts`) transcribed into GLSL,
 * in the same operation order, and the integration tests hold the two to each
 * other. The tables a boundary needs, such as which direction a slip wall
 * mirrors into and which three populations an open side must rebuild, are
 * generated from the TypeScript tables, so the two cannot drift apart.
 *
 * The shifted populations live in three RGBA32F textures, written at once
 * through three draw buffers:
 *
 *   texture 0: g0 g1 g2 g3
 *   texture 1: g4 g5 g6 g7
 *   texture 2: g8 δρ ux uy
 *
 * The last three channels are the macroscopic fields at collision time. Moving
 * walls read δρ from there, and anything that draws the flow reads all three.
 * A fourth target holds, per fluid cell, the momentum it exchanged with walls
 * that step and which body it touched, for drag and lift (see `links.ts`).
 *
 * Two sets of textures ping-pong, so a step reads one set and writes the
 * other, and nothing is read and written in the same pass.
 */

import { Q, shiftedEquilibrium } from "./d2q9";
import { CX, CY, OPPOSITE, W } from "./lattice";
import {
  MIRROR,
  NORMAL,
  PERIODIC,
  SIDES,
  isOpen,
  sideFrame,
  validateBoundaries,
  type Boundaries,
  type BoundaryKind,
} from "./boundaries";

export interface GpuLatticeOptions {
  nx: number;
  ny: number;
  tau: number;
  force?: readonly [number, number];
}

const KIND_CODE: Record<BoundaryKind, number> = {
  periodic: 0,
  noSlip: 1,
  slip: 2,
  velocity: 3,
  pressure: 4,
};

const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const glslFloat = (value: number) => {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
};
const intArray = (name: string, values: readonly number[]) =>
  `const int ${name}[${values.length}] = int[${values.length}](${values.join(", ")});`;
const floatArray = (name: string, values: readonly number[]) =>
  `const float ${name}[${values.length}] = float[${values.length}](${values.map(glslFloat).join(", ")});`;

/** E NE SE West NW SW North South, for the left side then the right. */
const FRAMES = (["left", "right"] as const).flatMap((side) => {
  const f = sideFrame(side);
  return [f.E, f.NE, f.SE, f.West, f.NW, f.SW, f.North, f.South];
});
/** n then t, for the left side then the right. */
const FRAME_VECTORS = (["left", "right"] as const).flatMap((side) => {
  const f = sideFrame(side);
  return [...f.n, ...f.t];
});

/**
 * Pull streaming, boundaries, collision and sponge. Each block follows the
 * CPU function named beside it; keep the two in step.
 */
const STEP = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform sampler2D u_solid;
uniform sampler2D u_inlet;
uniform sampler2D u_links0;
uniform sampler2D u_links1;
uniform sampler2D u_forceField;
uniform bool u_hasForceField;
uniform sampler2D u_psm;
uniform bool u_hasPsm;
uniform bool u_hasSolid;
uniform bool u_hasLinks;
uniform ivec2 u_size;
uniform float u_omega;
uniform float u_tau;
uniform float u_smagorinsky;
uniform vec2 u_force;
uniform int u_kind[4];
uniform vec2 u_wallVelocity[4];
uniform bool u_regularize[4];
uniform float u_openDeltaRho[4];
uniform float u_inletScale;
uniform float u_spongeWidth;
uniform float u_spongeMax;
uniform float u_spongeEq[9];
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;

${intArray("CXS", CX)}
${intArray("CYS", CY)}
${intArray("OPP", OPPOSITE)}
${floatArray("WS", W)}
${intArray(
  "MIRROR",
  SIDES.flatMap((side) => MIRROR[side])
)}
${intArray(
  "NORMALS",
  SIDES.flatMap((side) => NORMAL[side])
)}
${intArray("FRAME", FRAMES)}
${floatArray("FRAME_VECTOR", FRAME_VECTORS)}

float post(int i, ivec2 p) {
  if (i < 4) return texelFetch(u_g0, p, 0)[i];
  if (i < 8) return texelFetch(u_g1, p, 0)[i - 4];
  return texelFetch(u_g2, p, 0).x;
}

// The body number at p, 0 for fluid. Stored as a byte in a normalized texture.
int bodyAt(ivec2 p) {
  return u_hasSolid ? int(texelFetch(u_solid, p, 0).r * 255.0 + 0.5) : 0;
}

bool solidAt(ivec2 p) { return bodyAt(p) > 0; }

// Where the wall cuts link i of cell p; halfway without link fractions.
float linkQ(int i, ivec2 p) {
  if (!u_hasLinks) return 0.5;
  return i <= 4 ? texelFetch(u_links0, p, 0)[i - 1] : texelFetch(u_links1, p, 0)[i - 5];
}

// reconstructOpen in boundaries.ts. side is 0 for left, 1 for right.
void reconstruct(inout float g[9], int side, vec2 prescribed, vec2 force) {
  int E = FRAME[side * 8];
  int NE = FRAME[side * 8 + 1];
  int SE = FRAME[side * 8 + 2];
  int West = FRAME[side * 8 + 3];
  int NW = FRAME[side * 8 + 4];
  int SW = FRAME[side * 8 + 5];
  int North = FRAME[side * 8 + 6];
  int South = FRAME[side * 8 + 7];
  vec2 n = vec2(FRAME_VECTOR[side * 4], FRAME_VECTOR[side * 4 + 1]);
  vec2 t = vec2(FRAME_VECTOR[side * 4 + 2], FRAME_VECTOR[side * 4 + 3]);
  float knownDelta = ((g[0] + g[North]) + g[South]) + 2.0 * ((g[West] + g[NW]) + g[SW]);
  float fn = force.x * n.x + force.y * n.y;
  float ft = force.x * t.x + force.y * t.y;
  float rd;
  float rho;
  float un;
  float ut;
  if (u_kind[side] == 3) {
    float normal = prescribed.x * n.x + prescribed.y * n.y;
    float tangent = prescribed.x * t.x + prescribed.y * t.y;
    rd = ((knownDelta + normal) - fn / 2.0) / (1.0 - normal);
    rho = 1.0 + rd;
    un = normal - fn / (2.0 * rho);
    ut = tangent - ft / (2.0 * rho);
  } else {
    rd = u_openDeltaRho[side];
    rho = 1.0 + rd;
    un = (rd - knownDelta) / rho;
    ut = -(ft / (2.0 * rho));
  }
  g[E] = g[West] + ((2.0 * rho) * un) / 3.0;
  g[NE] = ((g[SW] + (g[South] - g[North]) / 2.0) + (rho * un) / 6.0) + (rho * ut) / 2.0;
  g[SE] = ((g[NW] + (g[North] - g[South]) / 2.0) + (rho * un) / 6.0) - (rho * ut) / 2.0;
  if (u_regularize[side]) {
    float ux = un * n.x + ut * t.x;
    float uy = un * n.y + ut * t.y;
    float usq = 1.5 * (ux * ux + uy * uy);
    float eq[9];
    float xx = 0.0;
    float xy = 0.0;
    float yy = 0.0;
    for (int i = 0; i < 9; i++) {
      float cx = float(CXS[i]);
      float cy = float(CYS[i]);
      float cu = cx * ux + cy * uy;
      eq[i] = WS[i] * (rd + rho * ((3.0 * cu + (4.5 * cu) * cu) - usq));
      float ne = g[i] - eq[i];
      xx = xx + (cx * cx) * ne;
      xy = xy + (cx * cy) * ne;
      yy = yy + (cy * cy) * ne;
    }
    for (int i = 0; i < 9; i++) {
      float cx = float(CXS[i]);
      float cy = float(CYS[i]);
      g[i] = eq[i] + (4.5 * WS[i]) * ((((cx * cx - 1.0 / 3.0) * xx) + ((2.0 * cx * cy) * xy)) + ((cy * cy - 1.0 / 3.0) * yy));
    }
  }
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 n = u_size;
  if (solidAt(c)) {
    o0 = texelFetch(u_g0, c, 0);
    o1 = texelFetch(u_g1, c, 0);
    o2 = vec4(texelFetch(u_g2, c, 0).x, 0.0, 0.0, 0.0);
    o3 = vec4(0.0);
    return;
  }
  float rhoOld = 1.0 + texelFetch(u_g2, c, 0).y;
  float g[9];
  float linkFx = 0.0;
  float linkFy = 0.0;
  int linkBody = 0;
  for (int i = 0; i < 9; i++) {
    ivec2 s = c - ivec2(CXS[i], CYS[i]);
    int wall = -1;
    bool open = false;
    if (s.x < 0 || s.x >= n.x) {
      int side = s.x < 0 ? 0 : 1;
      int kind = u_kind[side];
      if (kind == 0) s.x = (s.x + n.x) % n.x;
      else if (kind <= 2) wall = side;
      else open = true;
    }
    if (s.y < 0 || s.y >= n.y) {
      int side = s.y < 0 ? 2 : 3;
      if (u_kind[side] == 0) s.y = (s.y + n.y) % n.y;
      else wall = side;
    }
    if (wall >= 0) {
      if (u_kind[wall] == 2) {
        ivec2 normal = ivec2(NORMALS[wall * 2], NORMALS[wall * 2 + 1]);
        ivec2 from = ivec2(
          normal.x != 0 ? c.x : clamp(s.x, 0, n.x - 1),
          normal.y != 0 ? c.y : clamp(s.y, 0, n.y - 1)
        );
        g[i] = post(MIRROR[wall * 9 + i], from);
      } else {
        vec2 wv = u_wallVelocity[wall];
        g[i] = post(OPP[i], c) + (6.0 * WS[i]) * (rhoOld * (float(CXS[i]) * wv.x + float(CYS[i]) * wv.y));
      }
    } else if (open) {
      g[i] = post(i, c);
    } else {
      int body = bodyAt(s);
      if (body == 0) {
        g[i] = post(i, s);
      } else {
        // Interpolated bounce-back, as in CpuD2Q9.step.
        float outgoing = post(OPP[i], c);
        float q = linkQ(i, c);
        float twoQ = 2.0 * q;
        float incoming;
        if (q < 0.5) {
          ivec2 k = c + ivec2(CXS[i], CYS[i]);
          bool inside = k.x >= 0 && k.x < n.x && k.y >= 0 && k.y < n.y;
          incoming = inside && !solidAt(k)
            ? twoQ * outgoing + (1.0 - twoQ) * post(OPP[i], k)
            : outgoing;
        } else {
          incoming = outgoing / twoQ + ((twoQ - 1.0) / twoQ) * post(i, c);
        }
        g[i] = incoming;
        linkFx -= float(CXS[i]) * (outgoing + incoming);
        linkFy -= float(CYS[i]) * (outgoing + incoming);
        linkBody = body;
      }
    }
  }

  // The uniform force plus this cell's share of a force field.
  vec2 force = u_hasForceField ? u_force + texelFetch(u_forceField, c, 0).xy : u_force;

  if (c.x == 0 && u_kind[0] >= 3) {
    reconstruct(g, 0, texelFetch(u_inlet, ivec2(c.y, 0), 0).xy * u_inletScale, force);
  }
  if (c.x == n.x - 1 && u_kind[1] >= 3) {
    reconstruct(g, 1, texelFetch(u_inlet, ivec2(c.y, 0), 0).xy * u_inletScale, force);
  }

  // collideCell in d2q9.ts.
  float fx = force.x;
  float fy = force.y;
  float omega = u_omega;
  float dr = (((((((g[0] + g[1]) + g[2]) + g[3]) + g[4]) + g[5]) + g[6]) + g[7]) + g[8];
  float rho = 1.0 + dr;
  float jx = ((((g[1] - g[3]) + g[5]) - g[6]) - g[7]) + g[8];
  float jy = ((((g[2] - g[4]) + g[5]) + g[6]) - g[7]) - g[8];
  float ux = (jx + 0.5 * fx) / rho;
  float uy = (jy + 0.5 * fy) / rho;
  float usq = 1.5 * (ux * ux + uy * uy);
  float eq[9];
  for (int i = 0; i < 9; i++) {
    float cu = float(CXS[i]) * ux + float(CYS[i]) * uy;
    eq[i] = WS[i] * (dr + rho * ((3.0 * cu + (4.5 * cu) * cu) - usq));
  }
  if (u_smagorinsky > 0.0) {
    // The closure in collideCell: |Π| of the non-equilibrium stress with
    // Guo's force correction, then this cell's own relaxation time.
    float n1 = g[1] - eq[1];
    float n2 = g[2] - eq[2];
    float n3 = g[3] - eq[3];
    float n4 = g[4] - eq[4];
    float n5 = g[5] - eq[5];
    float n6 = g[6] - eq[6];
    float n7 = g[7] - eq[7];
    float n8 = g[8] - eq[8];
    float xx = (((((n1 + n3) + n5) + n6) + n7) + n8) + ux * fx;
    float yy = (((((n2 + n4) + n5) + n6) + n7) + n8) + uy * fy;
    float xy = (((n5 - n6) + n7) - n8) + 0.5 * (ux * fy + uy * fx);
    float stress = sqrt((xx * xx + yy * yy) + 2.0 * (xy * xy));
    float t = u_tau;
    float c2 = u_smagorinsky * u_smagorinsky;
    float tauEff = 0.5 * (t + sqrt(t * t + (((18.0 * 1.4142135623730951) * c2) * stress) / rho));
    omega = 1.0 / tauEff;
  }
  float keep = 1.0 - omega;
  float source = 1.0 - 0.5 * omega;
  // A partially saturated cell keeps its pre-collision populations for the
  // solid collision below.
  vec4 psm = u_hasPsm ? texelFetch(u_psm, c, 0) : vec4(0.0);
  float pre[9];
  for (int i = 0; i < 9; i++) pre[i] = g[i];
  for (int i = 0; i < 9; i++) {
    float cx = float(CXS[i]);
    float cy = float(CYS[i]);
    float cu = cx * ux + cy * uy;
    float cf = cx * fx + cy * fy;
    float s = WS[i] * (3.0 * ((cx - ux) * fx + (cy - uy) * fy) + (9.0 * cu) * cf);
    g[i] = (keep * g[i] + omega * eq[i]) + source * s;
  }

  // partiallySaturated in d2q9.ts: M2 and B2, at the base relaxation time.
  if (psm.x > 0.0) {
    float eps = psm.x;
    float wu = psm.z;
    float wv = psm.w;
    float halfTau = u_tau - 0.5;
    float B = (eps * halfTau) / ((1.0 - eps) + halfTau);
    float keepBase = 1.0 - u_omega;
    float usqWall = 1.5 * (wu * wu + wv * wv);
    for (int i = 0; i < 9; i++) {
      float cuW = float(CXS[i]) * wu + float(CYS[i]) * wv;
      float eqW = WS[i] * (dr + rho * ((3.0 * cuW + (4.5 * cuW) * cuW) - usqWall));
      float omegaS = (eqW - pre[i]) + keepBase * (pre[i] - eq[i]);
      float delta = B * omegaS;
      g[i] = (pre[i] + (1.0 - B) * (g[i] - pre[i])) + delta;
      linkFx -= float(CXS[i]) * delta;
      linkFy -= float(CYS[i]) * delta;
    }
    linkBody = int(psm.y + 0.5);
  }

  // spongeStrength in boundaries.ts.
  float start = float(n.x - 1) - u_spongeWidth;
  if (u_spongeWidth > 0.0 && float(c.x) >= start) {
    float a = (float(c.x) - start) / u_spongeWidth;
    float strength = u_spongeMax * a * a;
    for (int i = 0; i < 9; i++) {
      g[i] = (1.0 - strength) * g[i] + strength * u_spongeEq[i];
    }
  }

  o0 = vec4(g[0], g[1], g[2], g[3]);
  o1 = vec4(g[4], g[5], g[6], g[7]);
  o2 = vec4(g[8], dr, ux, uy);
  o3 = vec4(linkFx, linkFy, float(linkBody), 0.0);
}`;

interface TextureSet {
  textures: WebGLTexture[];
  framebuffer: WebGLFramebuffer;
}

export interface Sponge {
  width: number;
  max: number;
  reference: readonly [number, number];
}

export class GpuD2Q9 {
  readonly nx: number;
  readonly ny: number;
  tau: number;
  force: readonly [number, number];
  /** Multiplies the inlet profile, for an eased start or a gust. */
  inletScale = 1;
  /** The Smagorinsky constant, 0 for plain BGK. See `CollisionParameters`. */
  smagorinsky = 0;
  steps = 0;
  private boundaries: Boundaries = PERIODIC;
  private sponge: Sponge | undefined;
  private hasSolid = false;
  private readonly program: WebGLProgram;
  private readonly sets: [TextureSet, TextureSet];
  private readonly solidTexture: WebGLTexture;
  private readonly inletTexture: WebGLTexture;
  private readonly linkTextures: WebGLTexture[];
  private hasLinks = false;
  private readonly forceTexture: WebGLTexture;
  private hasForceField = false;
  private readonly psmTexture: WebGLTexture;
  private hasPsm = false;
  /** Which set holds the current populations. */
  private current = 0;
  private readonly location: (name: string) => WebGLUniformLocation | null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    options: GpuLatticeOptions
  ) {
    if (gl.getExtension("EXT_color_buffer_float") === null) {
      throw new Error("This GPU cannot render to float32 textures.");
    }
    this.nx = options.nx;
    this.ny = options.ny;
    this.tau = options.tau;
    this.force = options.force ?? [0, 0];
    this.program = link(gl, VERTEX, STEP);
    const cache = new Map<string, WebGLUniformLocation | null>();
    this.location = (name) => {
      if (!cache.has(name))
        cache.set(name, gl.getUniformLocation(this.program, name));
      return cache.get(name)!;
    };
    this.sets = [this.createSet(), this.createSet()];
    this.solidTexture = this.createTexture(gl.R8, this.nx, this.ny);
    this.inletTexture = this.createTexture(gl.RGBA32F, Math.max(1, this.ny), 1);
    this.linkTextures = [0, 1].map(() =>
      this.createTexture(gl.RGBA32F, this.nx, this.ny)
    );
    this.forceTexture = this.createTexture(gl.RG32F, this.nx, this.ny);
    this.psmTexture = this.createTexture(gl.RGBA32F, this.nx, this.ny);
  }

  private createTexture(format: number, width: number, height: number) {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
    // Exact texel reads only: a filtered read would average neighbours.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return texture;
  }

  private createSet(): TextureSet {
    const { gl } = this;
    const textures = [0, 1, 2, 3].map(() =>
      this.createTexture(gl.RGBA32F, this.nx, this.ny)
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    textures.forEach((texture, i) =>
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        texture,
        0
      )
    );
    gl.drawBuffers([
      gl.COLOR_ATTACHMENT0,
      gl.COLOR_ATTACHMENT1,
      gl.COLOR_ATTACHMENT2,
      gl.COLOR_ATTACHMENT3,
    ]);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`The lattice framebuffer is incomplete (${status}).`);
    }
    return { textures, framebuffer };
  }

  setBoundaries(boundaries: Boundaries) {
    validateBoundaries(boundaries);
    this.boundaries = boundaries;
  }

  /** Solid cells, `y·nx + x`: the body's number (1–255), 0 for fluid. */
  setSolid(solid: Uint8Array | undefined) {
    const { gl } = this;
    this.hasSolid = solid?.some((v) => v !== 0) === true;
    const bytes = new Uint8Array(this.nx * this.ny);
    if (solid) for (let k = 0; k < bytes.length; k++) bytes[k] = solid[k];
    gl.bindTexture(gl.TEXTURE_2D, this.solidTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.nx,
      this.ny,
      gl.RED,
      gl.UNSIGNED_BYTE,
      bytes
    );
  }

  /**
   * Link fractions from `computeLinks`, `i·N + k`; undefined for halfway walls
   * everywhere.
   */
  setLinks(q: Float32Array | undefined) {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    this.hasLinks = q !== undefined;
    for (let t = 0; t < 2; t++) {
      const texel = new Float32Array(4 * cells).fill(0.5);
      if (q) {
        for (let k = 0; k < cells; k++) {
          for (let c = 0; c < 4; c++)
            texel[4 * k + c] = q[(1 + 4 * t + c) * cells + k];
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, this.linkTextures[t]);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        nx,
        ny,
        gl.RGBA,
        gl.FLOAT,
        texel
      );
    }
  }

  /**
   * A force density per cell (`2k`, `2k + 1`), added to the uniform force;
   * undefined for none.
   */
  setForceField(field: ArrayLike<number> | undefined) {
    const { gl, nx, ny } = this;
    this.hasForceField = field !== undefined;
    if (field === undefined) return;
    gl.bindTexture(gl.TEXTURE_2D, this.forceTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      nx,
      ny,
      gl.RG,
      gl.FLOAT,
      Float32Array.from(field)
    );
  }

  /**
   * Partially saturated cells for moving solids (see `partiallySaturated` in
   * `d2q9.ts`): coverage, body number and solid velocity per cell, or
   * undefined for none.
   */
  setPartialSolids(
    psm:
      | {
          coverage: ArrayLike<number>;
          velocity: ArrayLike<number>;
          body: ArrayLike<number>;
        }
      | undefined
  ) {
    const { gl, nx, ny } = this;
    this.hasPsm = psm !== undefined;
    if (psm === undefined) return;
    const cells = nx * ny;
    const texel = new Float32Array(4 * cells);
    for (let k = 0; k < cells; k++) {
      texel[4 * k] = psm.coverage[k];
      texel[4 * k + 1] = psm.body[k];
      texel[4 * k + 2] = psm.velocity[2 * k];
      texel[4 * k + 3] = psm.velocity[2 * k + 1];
    }
    gl.bindTexture(gl.TEXTURE_2D, this.psmTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RGBA, gl.FLOAT, texel);
  }

  /** An open velocity side's profile, one value per row. */
  setInlet(ux: ArrayLike<number>, uy: ArrayLike<number>) {
    const { gl } = this;
    const texel = new Float32Array(4 * this.ny);
    for (let y = 0; y < this.ny; y++) {
      texel[4 * y] = ux[y];
      texel[4 * y + 1] = uy[y];
    }
    gl.bindTexture(gl.TEXTURE_2D, this.inletTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.ny,
      1,
      gl.RGBA,
      gl.FLOAT,
      texel
    );
  }

  setSponge(sponge: Sponge | undefined) {
    this.sponge = sponge;
  }

  /** Sets every cell to equilibrium at the density and velocity given. */
  initialize(
    at: (x: number, y: number) => { deltaRho?: number; ux: number; uy: number }
  ) {
    const cells = this.nx * this.ny;
    const populations = new Float32Array(Q * cells);
    const eq = new Array<number>(Q);
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const { deltaRho = 0, ux, uy } = at(x, y);
        shiftedEquilibrium(deltaRho, ux, uy, eq);
        const k = y * this.nx + x;
        for (let i = 0; i < Q; i++) populations[i * cells + k] = eq[i];
      }
    }
    this.setPopulations(populations);
  }

  /**
   * Uploads shifted populations, structure of arrays `i·N + k`. δρ goes beside
   * them, as each cell's sum, because a moving wall reads it before the first
   * collision has computed one.
   */
  setPopulations(populations: Float32Array) {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    const set = this.sets[this.current];
    for (let t = 0; t < 3; t++) {
      const texel = new Float32Array(4 * cells);
      for (let k = 0; k < cells; k++) {
        for (let c = 0; c < 4; c++) {
          const i = t * 4 + c;
          texel[k * 4 + c] = i < Q ? populations[i * cells + k] : 0;
        }
        if (t === 2) {
          let sum = 0;
          for (let i = 0; i < Q; i++)
            sum = Math.fround(sum + populations[i * cells + k]);
          texel[k * 4 + 1] = sum;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, set.textures[t]);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        nx,
        ny,
        gl.RGBA,
        gl.FLOAT,
        texel
      );
    }
    this.steps = 0;
  }

  step(count = 1) {
    const { gl } = this;
    const at = this.location;
    gl.useProgram(this.program);
    gl.viewport(0, 0, this.nx, this.ny);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.uniform2i(at("u_size"), this.nx, this.ny);
    gl.uniform1f(at("u_omega"), 1 / this.tau);
    gl.uniform1f(at("u_tau"), this.tau);
    gl.uniform1f(at("u_smagorinsky"), this.smagorinsky);
    gl.uniform2f(at("u_force"), this.force[0], this.force[1]);
    gl.uniform1i(at("u_hasSolid"), this.hasSolid ? 1 : 0);
    gl.uniform1i(at("u_hasLinks"), this.hasLinks ? 1 : 0);
    gl.uniform1i(at("u_hasForceField"), this.hasForceField ? 1 : 0);
    gl.uniform1i(at("u_hasPsm"), this.hasPsm ? 1 : 0);
    gl.uniform1f(at("u_inletScale"), this.inletScale);
    const specs = SIDES.map((side) => this.boundaries[side]);
    gl.uniform1iv(
      at("u_kind"),
      specs.map((s) => KIND_CODE[s.kind])
    );
    gl.uniform2fv(
      at("u_wallVelocity"),
      specs.flatMap((s) => [...(s.wallVelocity ?? [0, 0])])
    );
    gl.uniform1iv(
      at("u_regularize"),
      specs.map((s) => (isOpen(s) && s.regularize === true ? 1 : 0))
    );
    gl.uniform1fv(
      at("u_openDeltaRho"),
      specs.map((s) => s.deltaRho ?? 0)
    );
    gl.uniform1f(at("u_spongeWidth"), this.sponge?.width ?? 0);
    gl.uniform1f(at("u_spongeMax"), this.sponge?.max ?? 0);
    gl.uniform1fv(
      at("u_spongeEq"),
      shiftedEquilibrium(0, ...(this.sponge?.reference ?? [0, 0]))
    );
    const bind = (unit: number, texture: WebGLTexture, name: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(at(name), unit);
    };
    bind(3, this.solidTexture, "u_solid");
    bind(4, this.inletTexture, "u_inlet");
    bind(5, this.linkTextures[0], "u_links0");
    bind(6, this.linkTextures[1], "u_links1");
    bind(7, this.forceTexture, "u_forceField");
    bind(8, this.psmTexture, "u_psm");
    for (let n = 0; n < count; n++) {
      const from = this.sets[this.current];
      const to = this.sets[1 - this.current];
      for (let t = 0; t < 3; t++) bind(t, from.textures[t], `u_g${t}`);
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.current = 1 - this.current;
      this.steps++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** The three textures holding the current state, for anything drawing it. */
  get textures(): readonly WebGLTexture[] {
    return this.sets[this.current].textures.slice(0, 3);
  }

  /**
   * Each cell's exchanged momentum at the last step (`2k`, `2k + 1`) and the
   * body it touched, for `bodyForce`. Waits for the GPU.
   */
  readForces(): { cellForce: Float32Array; cellBody: Uint8Array } {
    const { nx, ny } = this;
    const texel = this.readForceTexels(0, 0, nx, ny);
    const cells = nx * ny;
    const cellForce = new Float32Array(2 * cells);
    const cellBody = new Uint8Array(cells);
    for (let k = 0; k < cells; k++) {
      cellForce[2 * k] = texel[4 * k];
      cellForce[2 * k + 1] = texel[4 * k + 1];
      cellBody[k] = Math.round(texel[4 * k + 2]);
    }
    return { cellForce, cellBody };
  }

  /**
   * Each body's exchanged momentum at the last step, summed over a rectangle
   * of cells that contains it, without the rest share (see `bodyForce`).
   * Reading only the rectangle is what makes sampling a force every few steps
   * affordable: walls are thin, and the field around them is not needed.
   */
  sumForces(
    x: number,
    y: number,
    width: number,
    height: number
  ): Map<number, [number, number]> {
    const texel = this.readForceTexels(x, y, width, height);
    const sums = new Map<number, [number, number]>();
    for (let k = 0; k < width * height; k++) {
      const body = Math.round(texel[4 * k + 2]);
      if (body === 0) continue;
      const sum = sums.get(body) ?? [0, 0];
      sum[0] += texel[4 * k];
      sum[1] += texel[4 * k + 1];
      sums.set(body, sum);
    }
    return sums;
  }

  private readForceTexels(x: number, y: number, width: number, height: number) {
    const { gl } = this;
    const texel = new Float32Array(4 * width * height);
    gl.bindFramebuffer(
      gl.READ_FRAMEBUFFER,
      this.sets[this.current].framebuffer
    );
    gl.readBuffer(gl.COLOR_ATTACHMENT3);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.FLOAT, texel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return texel;
  }

  /**
   * δρ, ux and uy at the last collision, `k`, without the populations: what a
   * stability or Mach check needs, at a third of the read.
   */
  readMacro(): { deltaRho: Float32Array; ux: Float32Array; uy: Float32Array } {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    const texel = new Float32Array(4 * cells);
    gl.bindFramebuffer(
      gl.READ_FRAMEBUFFER,
      this.sets[this.current].framebuffer
    );
    gl.readBuffer(gl.COLOR_ATTACHMENT2);
    gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, texel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    const deltaRho = new Float32Array(cells);
    const ux = new Float32Array(cells);
    const uy = new Float32Array(cells);
    for (let k = 0; k < cells; k++) {
      deltaRho[k] = texel[4 * k + 1];
      ux[k] = texel[4 * k + 2];
      uy[k] = texel[4 * k + 3];
    }
    return { deltaRho, ux, uy };
  }

  /**
   * Reads everything back: the shifted populations as `i·N + k`, and δρ, ux
   * and uy at the last collision. Slow, because it waits for the GPU; for
   * tests and measurements, not for drawing.
   */
  read(): {
    populations: Float32Array;
    deltaRho: Float32Array;
    ux: Float32Array;
    uy: Float32Array;
  } {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    const set = this.sets[this.current];
    const populations = new Float32Array(Q * cells);
    const deltaRho = new Float32Array(cells);
    const ux = new Float32Array(cells);
    const uy = new Float32Array(cells);
    const texel = new Float32Array(4 * cells);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, set.framebuffer);
    for (let t = 0; t < 3; t++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + t);
      gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, texel);
      for (let k = 0; k < cells; k++) {
        for (let c = 0; c < 4; c++) {
          const i = t * 4 + c;
          if (i < Q) populations[i * cells + k] = texel[k * 4 + c];
        }
        if (t === 2) {
          deltaRho[k] = texel[k * 4 + 1];
          ux[k] = texel[k * 4 + 2];
          uy[k] = texel[k * 4 + 3];
        }
      }
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return { populations, deltaRho, ux, uy };
  }

  dispose() {
    const { gl } = this;
    for (const set of this.sets) {
      for (const texture of set.textures) gl.deleteTexture(texture);
      gl.deleteFramebuffer(set.framebuffer);
    }
    gl.deleteTexture(this.solidTexture);
    gl.deleteTexture(this.inletTexture);
    for (const texture of this.linkTextures) gl.deleteTexture(texture);
    gl.deleteTexture(this.forceTexture);
    gl.deleteTexture(this.psmTexture);
    gl.deleteProgram(this.program);
  }
}

function link(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Lattice shader failed to compile: ${log}`);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Lattice shader failed to link: ${gl.getProgramInfoLog(program)}`
    );
  }
  return program;
}

/** A lattice on a context of its own, as the verification tests use. */
export function createStandaloneLattice(options: GpuLatticeOptions): {
  lattice: GpuD2Q9;
  release: () => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const gl = canvas.getContext("webgl2", { antialias: false });
  if (gl === null) throw new Error("This browser has no WebGL2.");
  const lattice = new GpuD2Q9(gl, options);
  return {
    lattice,
    release: () => {
      lattice.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
