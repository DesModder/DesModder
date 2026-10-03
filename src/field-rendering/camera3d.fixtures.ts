/**
 * Three frames Desmos 3D actually drew, captured 2026-10-02 on desmos.com/3d
 * in headless Chrome. Each holds the camera from `grapher3d.redrawResult` at
 * the moment of the screenshot, and, for each landmark Desmos drew as a pure
 * green point, the centroid of the green pixels it painted (CSS pixels from the
 * canvas corner). The projection has to land on those, not on anything derived
 * from it. Landmarks hidden by the translucent z = 0 plane were not detected
 * and are left out.
 */
export interface DrawnFrame {
  readonly description: string;
  readonly redrawResult: {
    readonly camera: {
      readonly worldMatrixWorld: readonly number[];
      readonly cameraMatrixWorldInverse: readonly number[];
      readonly cameraProjectionMatrix: readonly number[];
      readonly cameraType: string;
    };
    readonly screen: { readonly width: number; readonly height: number };
  };
  readonly drawn: readonly {
    readonly at: readonly [number, number, number];
    readonly x: number;
    readonly y: number;
  }[];
}

export const DRAWN_FRAMES: Record<string, DrawnFrame> = {
  perspective: {
    description:
      "tilt 1.10, turn 2.50; box [-5, 5] × [-5, 5] × [-5, 5]; 1200x800@1x; perspective 1",
    redrawResult: {
      camera: {
        worldMatrixWorld: [
          0.1085858573387216, 0.3204574462187735, 0.21334511184687763, 0,
          -0.14535825468678115, 0.2393888576415827, -0.2855940346566625, 0,
          -0.3564829440245742, 4.4408920985006264e-17, 0.18143844857023092, 0,
          0, 0, 0, 1,
        ],
        cameraMatrixWorldInverse: [
          0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -50, 1,
        ],
        cameraProjectionMatrix: [
          15.981866719091268, 0, 0, 0, 0, 16.95688776561408, 0, 0, 0, 0,
          -14.433035077986737, -1, 0, 0, -718.1874790791185, 0,
        ],
        cameraType: "PerspectiveCamera",
      },
      screen: { width: 800, height: 754 },
    },
    drawn: [
      { at: [0, 0, 0], x: 400.12, y: 377.28 },
      { at: [-4, -4, -4], x: 677.96, y: 431.19 },
      { at: [-4, -4, 4], x: 693.84, y: 243.65 },
      { at: [-4, 4, -4], x: 441.13, y: 722.16 },
      { at: [-4, 4, 4], x: 443.6, y: 547.65 },
      { at: [4, -4, 4], x: 358.31, y: 26.01 },
      { at: [4, 4, -4], x: 120.76, y: 503.46 },
      { at: [4, 4, 4], x: 104.28, y: 319.25 },
      { at: [4, 0, 0], x: 237.45, y: 268.52 },
    ],
  },
  orthographic: {
    description:
      "perspective 0 (orthographic); box [-5, 5] × [-5, 5] × [-5, 5]; 1200x800@1x; perspective 0",
    redrawResult: {
      camera: {
        worldMatrixWorld: [
          0.27779838907003124, -0.21612092234725588, 0.19005210326083471, 0,
          0.17837229434031926, 0.33658839392315865, 0.1220310521465709, 0,
          -0.22585698935801407, -3.33066907387547e-17, 0.3301342459638714, 0, 0,
          0, 0, 1,
        ],
        cameraMatrixWorldInverse: [
          0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -50, 1,
        ],
        cameraProjectionMatrix: [
          0.3194915254237288, 0, 0, 0, 0, 0.33898305084745756, 0, 0, 0, 0,
          -0.2886607015597348, 0, 1.418827390792149e-16, 1.5053871520341102e-16,
          -14.43303507798674, 1,
        ],
        cameraType: "OrthographicCamera",
      },
      screen: { width: 800, height: 754 },
    },
    drawn: [
      { at: [0, 0, 0], x: 400.08, y: 376.01 },
      { at: [-4, -4, 4], x: 461.57, y: 367.79 },
      { at: [-4, 4, -4], x: 117.51, y: 580.46 },
      { at: [-4, 4, 4], x: 117.46, y: 243.02 },
      { at: [4, -4, -4], x: 682.53, y: 510.84 },
      { at: [4, -4, 4], x: 682.55, y: 173.39 },
      { at: [4, 4, -4], x: 338.74, y: 386.05 },
      { at: [4, 4, 4], x: 338.46, y: 48.58 },
      { at: [0, 4, 0], x: 228.1, y: 313.76 },
    ],
  },
  nonCubic2x: {
    description:
      "non-cubic box, off-centre; box [-10, 10] × [-2, 4] × [-1, 3]; 1000x700@2x; perspective 1",
    redrawResult: {
      camera: {
        worldMatrixWorld: [
          0.12590783920785328, -0.13934134186943306, 0.06878376605010186, 0,
          0.4076117725833977, 0.47823739393301523, 0.22267932625195108, 0,
          -0.4794255386042029, 5.551115123125783e-17, 0.8775825618903728, 0,
          0.07181376602080519, -0.4782373939330153, -1.1002618881423238, 1,
        ],
        cameraMatrixWorldInverse: [
          0, 0, -1, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -50, 1,
        ],
        cameraProjectionMatrix: [
          16.956018929881502, 0, 0, 0, 0, 16.59304604759046, 0, 0, 0, 0,
          -14.433035077986737, -1, 0, 0, -718.1874790791185, 0,
        ],
        cameraType: "PerspectiveCamera",
      },
      screen: { width: 640, height: 654 },
    },
    drawn: [
      { at: [0, 1, 1], x: 319.85, y: 326.94 },
      { at: [-8, -1.4, -0.6], x: 323.64, y: 603.76 },
      { at: [-8, 3.4, 2.6], x: 70.51, y: 173.88 },
      { at: [8, -1.4, -0.6], x: 561.7, y: 475.24 },
      { at: [8, -1.4, 2.6], x: 569.21, y: 170.49 },
      { at: [8, 3.4, -0.6], x: 316.64, y: 359.7 },
      { at: [8, 1, 1], x: 438.63, y: 268.35 },
      { at: [0, 1, 2.6], x: 320.02, y: 172.13 },
    ],
  },
};
