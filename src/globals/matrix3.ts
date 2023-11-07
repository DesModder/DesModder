import type { Grapher3d } from "./Calc";

/** Most methods mutate this. */
export interface Matrix3 {
  __nominallyMatrix3: undefined;
  /** Row-major 9 elements. */
  elements: number[];
  clone: () => Matrix3;
  set: (
    n11: number,
    n12: number,
    n13: number,
    n21: number,
    n22: number,
    n23: number,
    n31: number,
    n32: number,
    n33: number
  ) => this;
  multiply: (m: Matrix3) => this;
  invert: () => this;
  transpose: () => this;
  equals: (m: Matrix3) => boolean;
}

export function approx3su(a: Matrix3, b: Matrix3) {
  const A = a.elements;
  const B = b.elements;

  for (let i = 0; i < 9; i++) {
    if (Math.abs(A[i] - B[i]) > 1e-10) return false;
  }

  return true;
}

/** We don't have access to the Matrix3 constructor directly. This should suffice. */
export function matrix3(
  grapher3d: Grapher3d,
  n11: number,
  n12: number,
  n13: number,
  n21: number,
  n22: number,
  n23: number,
  n31: number,
  n32: number,
  n33: number
): Matrix3 {
  return grapher3d.controls.worldRotation3D
    .clone()
    .set(n11, n12, n13, n21, n22, n23, n31, n32, n33);
}

type Num3 = [number, number, number];
export function matrix3Rows(grapher3d: Grapher3d, a: Num3, b: Num3, c: Num3) {
  return matrix3(grapher3d, ...a, ...b, ...c);
}

// Identity matrix for m is x-back, y-left, z-up.
// If z points straight up, then top-left 2x2 is xy rotation only. m33 is 1, and it's row/column buddies are 0.
export function setOrientation(grapher3d: Grapher3d, m: Matrix3) {
  grapher3d.controls.worldRotation3D = m;
  grapher3d.viewportController.animateToOrientation(m);
  grapher3d.transition.duration = 0;
}

/**
 * Construct a Matrix3 orientation from:
 *   - zTip: angle (radians) to tip the cube forwards
 *   - xyRot: angle (radians) to rotate the cube's x towards y
 */
export function orientationFromEuler(
  grapher3d: Grapher3d,
  zTip: number,
  xyRot: number
): Matrix3 {
  const zTipMat = matrix3Rows(
    grapher3d,
    [Math.cos(zTip), 0, -Math.sin(zTip)],
    [0, 1, 0],
    [Math.sin(zTip), 0, Math.cos(zTip)]
  );
  const xyRotMat = matrix3Rows(
    grapher3d,
    [Math.sin(xyRot), Math.cos(xyRot), 0],
    [-Math.cos(xyRot), Math.sin(xyRot), 0],
    [0, 0, 1]
  );
  // Should multiply out to the following, where cz=Math.cos(zTip) etc.
  // [ cz*sxy, cz*cxy, -sz ]
  // [ -cxy,   sxy,    0   ]
  // [ sz*sxy, sz*cxy, cz  ]
  return zTipMat.multiply(xyRotMat);
}

export function getOrientation(grapher3d: Grapher3d): Matrix3 {
  return grapher3d.controls.worldRotation3D;
}

export function eulerFromOrientation(m: Matrix3) {
  return {
    // Column-major, so this is atan2(sz, cz)
    zTip: Math.atan2(-m.elements[6], m.elements[8]),
    // Column-major, so this is atan2(sxy, cxy)
    xyRot: atan2positive(m.elements[4], -m.elements[1]),
  };
}

function atan2positive(y: number, x: number) {
  let a = Math.atan2(y, x);
  if (a < 0) a += 2 * Math.PI;
  return a;
}
