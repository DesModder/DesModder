import {
  cameraFromRedrawResult,
  mathToClip,
  multiplyMat4,
  projectToScreen,
  readCamera3D,
  type Mat4,
} from "./camera3d";
import { DRAWN_FRAMES } from "./camera3d.fixtures";

describe("cameraFromRedrawResult", () => {
  test("reads each captured frame, and knows orthographic from perspective", () => {
    for (const [name, frame] of Object.entries(DRAWN_FRAMES)) {
      const camera = cameraFromRedrawResult(frame.redrawResult);
      expect(camera).toBeDefined();
      expect(camera!.orthographic).toBe(name === "orthographic");
      expect(camera!.width).toBe(frame.redrawResult.screen.width);
    }
  });

  test("refuses anything that is not a camera rather than guessing", () => {
    const { redrawResult } = DRAWN_FRAMES.perspective;
    const { camera, screen } = redrawResult;
    const broken: unknown[] = [
      undefined,
      null,
      {},
      { screen },
      { camera },
      {
        camera: {
          ...camera,
          worldMatrixWorld: camera.worldMatrixWorld.slice(1),
        },
        screen,
      },
      {
        camera: {
          ...camera,
          cameraProjectionMatrix: [
            ...camera.cameraProjectionMatrix.slice(1),
            NaN,
          ],
        },
        screen,
      },
      { camera, screen: { width: 0, height: 754 } },
      { camera, screen: { width: "800", height: 754 } },
    ];
    for (const result of broken)
      expect(cameraFromRedrawResult(result)).toBeUndefined();
    expect(readCamera3D(undefined)).toBeUndefined();
    expect(readCamera3D({})).toBeUndefined();
    expect(readCamera3D({ redrawResult })).toBeDefined();
  });
});

describe("projectToScreen", () => {
  // The fixtures hold where Desmos *painted* each landmark: the centroid of
  // its pixels in a screenshot, not anything computed from these matrices.
  test("lands on the points Desmos drew, in every captured frame", () => {
    for (const frame of Object.values(DRAWN_FRAMES)) {
      const camera = cameraFromRedrawResult(frame.redrawResult)!;
      const clip = mathToClip(camera);
      let sumSquares = 0;
      for (const point of frame.drawn) {
        const projected = projectToScreen(camera, ...point.at, clip)!;
        const error = Math.hypot(projected.x - point.x, projected.y - point.y);
        // 1.6 px was the worst measured, from shading biasing the centroid.
        expect(error).toBeLessThan(1.75);
        sumSquares += error * error;
      }
      expect(Math.sqrt(sumSquares / frame.drawn.length)).toBeLessThan(0.75);
      expect(frame.drawn.length).toBeGreaterThanOrEqual(7);
    }
  });

  test("is three.js's applyMatrix4 chain, divide and all", () => {
    // Desmos applies world, view and projection one at a time, dividing by w
    // after each. Folding them into one matrix and dividing once is the same
    // only because world and view are affine; this pins that it is.
    const apply = (m: Mat4, [x, y, z]: number[]) => {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [0, 1, 2].map(
        (i) => (m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i]) / w
      );
    };
    for (const frame of Object.values(DRAWN_FRAMES)) {
      const camera = cameraFromRedrawResult(frame.redrawResult)!;
      for (const point of frame.drawn) {
        const ndc = apply(
          camera.projection,
          apply(camera.view, apply(camera.world, [...point.at]))
        );
        const projected = projectToScreen(camera, ...point.at)!;
        expect(projected.x).toBeCloseTo(((ndc[0] + 1) * camera.width) / 2, 9);
        expect(projected.y).toBeCloseTo(((1 - ndc[1]) * camera.height) / 2, 9);
        expect(projected.depth).toBeCloseTo(ndc[2], 9);
      }
    }
  });

  test("returns nothing for a point at or behind a perspective camera", () => {
    const frame = DRAWN_FRAMES.perspective;
    const camera = cameraFromRedrawResult(frame.redrawResult)!;
    // With the world matrix replaced by the identity, math coordinates are
    // world coordinates, and this view puts the camera at world x = −50.
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const atWorld = { ...camera, world: identity };
    expect(projectToScreen(atWorld, 0, 0, 0)).toBeDefined();
    expect(projectToScreen(atWorld, -50, 0, 0)).toBeUndefined();
    expect(projectToScreen(atWorld, -80, 0, 0)).toBeUndefined();
  });
});

describe("multiplyMat4", () => {
  test("is column-major a · b", () => {
    const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1];
    const scale = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1];
    // Scale then translate: a point at (1, 1, 1) goes to (4, 5, 6).
    const m = multiplyMat4(translate, scale);
    expect([m[12], m[13], m[14]]).toEqual([2, 3, 4]);
    expect(m[0] * 1 + m[12]).toBe(4);
    // Translate then scale: (1, 1, 1) goes to (6, 8, 10).
    const n = multiplyMat4(scale, translate);
    expect([n[12], n[13], n[14]]).toEqual([4, 6, 8]);
  });
});
