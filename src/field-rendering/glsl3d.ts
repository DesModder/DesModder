/**
 * GLSL shared by everything drawn over Desmos 3D: arrows, streamlines, the
 * glow cloud and the depth copies of surfaces. One copy of each, because two
 * shaders that disagree about where a sample is or what the cutaway removes
 * draw two pictures that do not line up.
 *
 * Ported from the step-1 mock-up (`docs/mockups/vector-3d-arrows/`), where
 * each was settled against a picture.
 */

/** The PCG hash, so a jittered sample is the same point on the CPU and GPU. */
export const HASH_GLSL = `
uint vtPcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
vec3 vtHash3(uint i) {
  return vec3(vtPcg(i), vtPcg(i ^ 0x9e3779b9u), vtPcg(i ^ 0x85ebca6bu)) / 4294967295.0;
}
`;

/** Anything Desmos would clip to the box, discarded the same way. */
export const CLIP_GLSL = `
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
bool vtOutsideBox(vec3 m) {
  vec3 eps = (u_boxMax - u_boxMin) * 1.0e-4;
  return any(lessThan(m, u_boxMin - eps)) || any(greaterThan(m, u_boxMax + eps))
    || any(isnan(m));
}
`;

/**
 * The cutaway: off, the half of the box nearer the camera, or a wedge out of
 * it like a slice out of a cake, empty.
 *
 * The wedge is measured round the vertical axis through the box's centre, in
 * box half-widths so it stays symmetric in a box with unequal axes.
 */
export const CUT_GLSL = `
uniform int u_cut;
uniform float u_cutZ;
uniform vec3 u_cutCentre;
uniform vec3 u_cutHalf;
uniform float u_cutAzimuth;
uniform float u_cutAngle;
bool vtCutAway(vec3 math, vec3 view) {
  if (u_cut == 1) return view.z > u_cutZ;
  if (u_cut == 2) {
    vec2 q = ((math - u_cutCentre) / u_cutHalf).xy;
    float d = atan(q.y, q.x) - u_cutAzimuth;
    d = mod(d + 3.14159265, 6.2831853) - 3.14159265;
    return abs(d) < 0.5 * u_cutAngle;
  }
  return false;
}
`;

/**
 * Where sample `id` is, for every placement. Needs `CLIP_GLSL`'s box uniforms,
 * `HASH_GLSL`, and a `float vtSurface(vec2)` (which may return NaN).
 */
export const SAMPLE_GLSL = `
uniform int u_sampling;
uniform int u_count;
uniform int u_sliceAxis;
uniform float u_slicePos;
bool vtSample(int id, out vec3 pos) {
  vec3 lo = u_boxMin;
  vec3 hi = u_boxMax;
  int n = u_count;
  if (u_sampling <= 1) {
    ivec3 cell = ivec3(id % n, (id / n) % n, id / (n * n));
    // Cell-centred, so no arrow starts on a face of the box, where Desmos
    // would clip it in half.
    vec3 t = (vec3(cell) + 0.5) / float(n);
    // Kept within 14-86% of each cell: fewer tight clumps than random points,
    // without the lattice the eye reads as structure.
    if (u_sampling == 1) t += (vtHash3(uint(id)) - 0.5) * 0.72 / float(n);
    pos = mix(lo, hi, t);
    return true;
  }
  vec2 t = (vec2(id % n, id / n) + 0.5) / float(n);
  if (u_sampling == 2) {
    float s = u_slicePos;
    if (u_sliceAxis == 0) pos = mix(lo, hi, vec3(s, t.x, t.y));
    else if (u_sliceAxis == 1) pos = mix(lo, hi, vec3(t.x, s, t.y));
    else pos = mix(lo, hi, vec3(t.x, t.y, s));
    return true;
  }
  vec2 q = mix(lo.xy, hi.xy, t);
  float z = vtSurface(q);
  pos = vec3(q, z);
  return !isnan(z) && z >= lo.z && z <= hi.z;
}
`;

export type Placement3D = "grid" | "jitter" | "slice" | "surface";
export const PLACEMENT_INDEX: Record<Placement3D, number> = {
  grid: 0,
  jitter: 1,
  slice: 2,
  surface: 3,
};

export type Cutaway3D = "off" | "half" | "wedge";

export interface CutSettings {
  cutaway: Cutaway3D;
  /** The wedge's angle, in radians. */
  angle: number;
  /** Where a fixed wedge points, radians round z; undefined faces the camera. */
  turn: number | undefined;
}

/**
 * The cutaway's uniforms for this frame, and the camera's direction round
 * the vertical axis (for fixing a wedge where it currently points).
 */
export function cutUniforms(
  mathToView: readonly number[],
  box: { min: readonly number[]; max: readonly number[] },
  cut: CutSettings
) {
  const centre = [0, 1, 2].map((i) => (box.min[i] + box.max[i]) / 2);
  const half = [0, 1, 2].map((i) => (box.max[i] - box.min[i]) / 2);
  const m = mathToView;
  const cutZ = m[2] * centre[0] + m[6] * centre[1] + m[10] * centre[2] + m[14];
  // The camera's direction in math coordinates is the third column of the
  // inverse of math-to-view's linear part: the cross product of its first
  // two rows. Divided by the half-widths, the box's scaling comes back out.
  const r0 = [m[0], m[4], m[8]];
  const r1 = [m[1], m[5], m[9]];
  const toCamera = [
    r0[1] * r1[2] - r0[2] * r1[1],
    r0[2] * r1[0] - r0[0] * r1[2],
    r0[0] * r1[1] - r0[1] * r1[0],
  ];
  const facing = Math.atan2(toCamera[1] / half[1], toCamera[0] / half[0]);
  return {
    mode: { off: 0, half: 1, wedge: 2 }[cut.cutaway],
    cutZ,
    centre,
    half,
    azimuth: cut.turn ?? facing,
    facing,
    angle: cut.angle,
  };
}

export function uploadCut(
  gl: WebGL2RenderingContext,
  u: Record<string, WebGLUniformLocation | null>,
  c: ReturnType<typeof cutUniforms>
) {
  gl.uniform1i(u.u_cut, c.mode);
  gl.uniform1f(u.u_cutZ, c.cutZ);
  gl.uniform3fv(u.u_cutCentre, c.centre);
  gl.uniform3fv(u.u_cutHalf, c.half);
  gl.uniform1f(u.u_cutAzimuth, c.azimuth);
  gl.uniform1f(u.u_cutAngle, c.angle);
}

/** The nearest and farthest the box's corners are from the camera. */
export function depthRange(
  mathToView: readonly number[],
  box: { min: readonly number[]; max: readonly number[] }
): [number, number] {
  const m = mathToView;
  let near = Infinity;
  let far = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max[0] : box.min[0];
    const y = i & 2 ? box.max[1] : box.min[1];
    const z = i & 4 ? box.max[2] : box.min[2];
    const depth = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
    near = Math.min(near, depth);
    far = Math.max(far, depth);
  }
  return [near, far];
}

/** "#rrggbb" as 0..1 channels; a malformed colour is the default blue. */
export function hexToUnitRGB(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return [0.18, 0.43, 0.84];
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
