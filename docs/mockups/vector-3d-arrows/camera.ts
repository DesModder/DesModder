/**
 * The stand-in for Desmos 3D's camera.
 *
 * Desmos hands an overlay three column-major matrices per redraw — math to
 * world, world to camera, camera to clip — and nothing else (DESMOS_3D_CAMERA.md).
 * This builds the same three from a turn, a tilt, a zoom, a perspective amount
 * and a box, in the same convention, so the overlay below receives exactly the
 * kind of object `cameraFromRedrawResult` would give it in the real page. The
 * numbers are not Desmos's (its field of view per perspective step is not
 * measured here); the shape of the data, and what an overlay can and cannot do
 * with it, is.
 */
import type { Camera3D, Mat4 } from "../../../src/field-rendering/camera3d";
import { multiplyMat4 } from "../../../src/field-rendering/camera3d";

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

export interface View {
  turn: number;
  tilt: number;
  zoom: number;
  /** 0 is orthographic, as Desmos's perspective slider at 0 is. */
  perspective: number;
}

/** The camera sits this far out, as Desmos's does. */
const CAMERA_DISTANCE = 50;

// prettier-ignore
const translate = (x: number, y: number, z: number): Mat4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  x, y, z, 1,
];
// prettier-ignore
const scale = (x: number, y: number, z: number): Mat4 => [
  x, 0, 0, 0,
  0, y, 0, 0,
  0, 0, z, 0,
  0, 0, 0, 1,
];
// prettier-ignore
const rotateX = (a: number): Mat4 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};
// prettier-ignore
const rotateY = (a: number): Mat4 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
};
/** Math has z up; three.js world has y up. Math y goes into the screen. */
// prettier-ignore
const Z_UP: Mat4 = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

const chain = (...ms: Mat4[]) => ms.reduce((a, b) => multiplyMat4(a, b));

export function buildCamera(
  box: Box,
  view: View,
  width: number,
  height: number
): Camera3D {
  const aspect = width / height;
  // How much of the clip square one box half-width fills, before zoom.
  const halfHeight = 2.3 / view.zoom;
  const near = 1;
  const far = 200;
  let projection: Mat4;
  let worldScale: number;
  const orthographic = view.perspective <= 0;
  if (orthographic) {
    worldScale = 1;
    // prettier-ignore
    projection = [
      1 / (halfHeight * aspect), 0, 0, 0,
      0, 1 / halfHeight, 0, 0,
      0, 0, -2 / (far - near), 0,
      0, 0, -(far + near) / (far - near), 1,
    ];
  } else {
    const fov = 2 * Math.atan(0.13 * view.perspective);
    const f = 1 / Math.tan(fov / 2);
    // Keep the box the same apparent size as the perspective changes, so the
    // slider changes the depth cue and nothing else.
    worldScale = CAMERA_DISTANCE / (f * halfHeight);
    // prettier-ignore
    projection = [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0,
    ];
  }
  const half = [0, 1, 2].map((i) => (box.max[i] - box.min[i]) / 2);
  const centre = [0, 1, 2].map((i) => (box.max[i] + box.min[i]) / 2);
  const world = chain(
    rotateX(view.tilt),
    rotateY(view.turn),
    Z_UP,
    scale(worldScale / half[0], worldScale / half[1], worldScale / half[2]),
    translate(-centre[0], -centre[1], -centre[2])
  );
  return {
    world,
    view: translate(0, 0, -CAMERA_DISTANCE),
    projection,
    orthographic,
    width,
    height,
  };
}
