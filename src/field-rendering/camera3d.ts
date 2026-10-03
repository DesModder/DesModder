/**
 * The camera Desmos 3D drew its last frame with, and the projection it implies,
 * for anything that has to be drawn over the 3D graph.
 *
 * Desmos 3D builds its geometry in a worker and draws it on the main thread,
 * and every redraw hands back the camera it used: `grapher3d.redrawResult`
 * carries `camera.worldMatrixWorld`, `cameraMatrixWorldInverse` and
 * `cameraProjectionMatrix`, three column-major 4×4 matrices in three.js's
 * convention. Desmos's own `mathCoordinatesToScreenCoordinates` is nothing more
 * than those three applied in that order, then a perspective divide, then a
 * mapping of normalised device coordinates onto the canvas with y pointing
 * down. This module is that same chain, so a shader can do it too.
 *
 * Reading the camera Desmos *drew with*, rather than rebuilding one from
 * `controls.worldRotation3D`, is the whole point. The rotation alone says
 * nothing about the box's scaling, the camera distance, the field of view that
 * the perspective slider sets, or orthographic mode, and it runs ahead of the
 * picture: after a rotation, the redraw that shows it arrives two or three
 * frames later. An overlay that follows the rotation is ahead of the graph for
 * those frames; one that follows the redraw is never out of step with it.
 *
 * Measured against points Desmos drew (see `camera3d.fixtures.ts` and the
 * integration test), this lands within 0.1–0.7 px RMS and 1.8 px at worst,
 * across three rotations including one from below, perspective 0
 * (orthographic), perspective 3, a non-cubic off-centre box, and a 2×
 * device-pixel ratio. The residual is the detector's, not the projection's:
 * shading darkens one side of each drawn sphere and pulls its centroid.
 *
 * These are private fields of Desmos's renderer, not public API, so everything
 * here is read defensively and returns `undefined` rather than guessing when a
 * field is missing or malformed. The integration test is the guard that they
 * still mean what they meant when this was written.
 */

/** A column-major 4×4 matrix, as three.js and WebGL lay one out. */
export type Mat4 = readonly number[];

export interface Camera3D {
  /** Math coordinates to world coordinates: the rotation and the box's scale. */
  readonly world: Mat4;
  /** World to camera coordinates. */
  readonly view: Mat4;
  /** Camera to clip coordinates. Orthographic when perspective is 0. */
  readonly projection: Mat4;
  readonly orthographic: boolean;
  /**
   * The CSS-pixel size of the graph canvas the projection maps onto. Taken
   * from the redraw itself, so a frame and its size never disagree mid-resize.
   */
  readonly width: number;
  readonly height: number;
}

export interface ScreenPoint {
  /** CSS pixels from the graph canvas's left edge. */
  readonly x: number;
  /** CSS pixels from the graph canvas's top edge. */
  readonly y: number;
  /** Normalised device depth, −1 at the near plane and 1 at the far plane. */
  readonly depth: number;
}

function isMat4(m: unknown): m is Mat4 {
  if (m === null || typeof m !== "object") return false;
  const { length } = m as { length?: unknown };
  if (length !== 16) return false;
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite((m as ArrayLike<unknown>)[i])) return false;
  }
  return true;
}

/**
 * The camera from one redraw result, or `undefined` if it is not one.
 *
 * Takes the redraw result rather than the grapher so that a hook on
 * `onRedraw3dResults` can pass its argument straight in: DesModder's
 * `hookIntoFunction` runs before the original, when `grapher3d.redrawResult`
 * still holds the previous frame, but the argument is already the new one.
 */
export function cameraFromRedrawResult(result: unknown): Camera3D | undefined {
  if (result === null || typeof result !== "object") return undefined;
  const { camera, screen } = result as { camera?: unknown; screen?: unknown };
  if (camera === null || typeof camera !== "object") return undefined;
  if (screen === null || typeof screen !== "object") return undefined;
  const c = camera as Record<string, unknown>;
  const { width, height } = screen as { width?: unknown; height?: unknown };
  if (
    !isMat4(c.worldMatrixWorld) ||
    !isMat4(c.cameraMatrixWorldInverse) ||
    !isMat4(c.cameraProjectionMatrix) ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !(width > 0) ||
    !(height > 0)
  ) {
    return undefined;
  }
  return {
    world: Array.from(c.worldMatrixWorld),
    view: Array.from(c.cameraMatrixWorldInverse),
    projection: Array.from(c.cameraProjectionMatrix),
    orthographic: c.cameraType === "OrthographicCamera",
    width,
    height,
  };
}

/** The camera of the frame Desmos 3D is showing now, if it is showing one. */
export function readCamera3D(grapher3d: unknown): Camera3D | undefined {
  if (grapher3d === null || typeof grapher3d !== "object") return undefined;
  return cameraFromRedrawResult(
    (grapher3d as { redrawResult?: unknown }).redrawResult
  );
}

/** `a · b` for column-major 4×4 matrices. */
export function multiplyMat4(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * Math coordinates straight to clip coordinates, `projection · view · world`.
 *
 * This is the one matrix a shader needs. On a canvas covering the graph canvas
 * exactly, `gl_Position = mathToClip * vec4(x, y, z, 1.0)` puts a vertex where
 * Desmos would draw that point: WebGL's own viewport mapping is the same as
 * Desmos's, including y pointing up in clip space and down on screen.
 */
export function mathToClip(camera: Camera3D): number[] {
  return multiplyMat4(
    camera.projection,
    multiplyMat4(camera.view, camera.world)
  );
}

/**
 * Where a point in math coordinates lands on the graph canvas, or `undefined`
 * if it is at or behind the camera, where a perspective divide has no meaning.
 *
 * Accepts the combined matrix from `mathToClip` so a caller projecting many
 * points multiplies the three matrices once, not once per point.
 */
export function projectToScreen(
  camera: Camera3D,
  x: number,
  y: number,
  z: number,
  clip: Mat4 = mathToClip(camera)
): ScreenPoint | undefined {
  const cx = clip[0] * x + clip[4] * y + clip[8] * z + clip[12];
  const cy = clip[1] * x + clip[5] * y + clip[9] * z + clip[13];
  const cz = clip[2] * x + clip[6] * y + clip[10] * z + clip[14];
  const cw = clip[3] * x + clip[7] * y + clip[11] * z + clip[15];
  if (!(cw > 0)) return undefined;
  return {
    x: ((cx / cw + 1) * camera.width) / 2,
    y: ((1 - cy / cw) * camera.height) / 2,
    depth: cz / cw,
  };
}
