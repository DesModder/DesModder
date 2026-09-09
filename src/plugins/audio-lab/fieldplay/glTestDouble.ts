/**
 * A WebGL2 stand-in, so the field renderer's allocation and frame paths can be
 * tested without a GPU.
 *
 * Test-only: nothing in the plugin imports this and it is never in the bundle.
 *
 * Vector Tools has a fake of its own. This one is deliberately not shared with
 * it: Audio Lab is required to stay independent of that plugin, and a test
 * helper reaching across the boundary is still a dependency across the
 * boundary. It is also much smaller, because this renderer has no trails, no
 * reprojection, and no instanced drawing to pretend to support.
 */

export interface FakeGL {
  readonly counts: {
    createTexture: number;
    deleteTexture: number;
    createProgram: number;
    deleteProgram: number;
    linkProgram: number;
    pointsDrawn: number;
    drawCalls: number;
  };
  /** Every uniform value the renderer has set, by name. */
  readonly uniforms: Map<string, number[]>;
  [key: string]: unknown;
}

export function fakeCanvas(gl: FakeGL) {
  return {
    width: 0,
    height: 0,
    clientWidth: 400,
    clientHeight: 300,
    getBoundingClientRect: () => ({ width: 400, height: 300 }),
    getContext: () => gl,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

/** A canvas whose context request fails, for the no-WebGL2 path. */
export function canvasWithoutWebGL2() {
  return {
    width: 0,
    height: 0,
    getContext: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
}

/**
 * Just enough of WebGL2 to run the renderer headlessly.
 *
 * Every GL name resolves to a distinct number, so the renderer's own enum
 * comparisons still mean something, and the handful of calls whose return value
 * it inspects are answered explicitly.
 */
export function fakeGL(options: { floatTextures?: boolean } = {}): FakeGL {
  const counts = {
    createTexture: 0,
    deleteTexture: 0,
    createProgram: 0,
    deleteProgram: 0,
    linkProgram: 0,
    pointsDrawn: 0,
    drawCalls: 0,
  };
  const uniforms = new Map<string, number[]>();
  // Uniform locations carry their own name, so a test can see what was set
  // where without the renderer having to expose anything.
  const locations = new Map<string, { name: string }>();
  const constants = new Map<string, number>();
  let nextConstant = 1000;
  const POINTS = 100;

  const methods: Record<string, (...args: any[]) => unknown> = {
    getExtension: (name: string) =>
      name === "EXT_color_buffer_float"
        ? options.floatTextures === false
          ? null
          : {}
        : {},
    isContextLost: () => false,
    createBuffer: () => ({}),
    createVertexArray: () => ({}),
    createFramebuffer: () => ({}),
    createShader: () => ({}),
    createTexture: () => {
      counts.createTexture++;
      return {};
    },
    deleteTexture: () => counts.deleteTexture++,
    createProgram: () => {
      counts.createProgram++;
      return {};
    },
    deleteProgram: () => counts.deleteProgram++,
    linkProgram: () => counts.linkProgram++,
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getProgramInfoLog: () => "",
    getShaderInfoLog: () => "",
    getUniformLocation: (_program: unknown, name: string) => {
      const existing = locations.get(name);
      if (existing !== undefined) return existing;
      const location = { name };
      locations.set(name, location);
      return location;
    },
    uniform1f: (location: { name: string } | null, value: number) => {
      if (location !== null) uniforms.set(location.name, [value]);
    },
    uniform1i: (location: { name: string } | null, value: number) => {
      if (location !== null) uniforms.set(location.name, [value]);
    },
    uniform4f: (location: { name: string } | null, ...values: number[]) => {
      if (location !== null) uniforms.set(location.name, values);
    },
    drawArrays: (mode: number, _first: number, count: number) => {
      counts.drawCalls++;
      if (mode === POINTS) counts.pointsDrawn += count;
    },
  };

  const target: FakeGL = { counts, uniforms };
  return new Proxy(target, {
    get(target, property: string) {
      if (property in target) return target[property];
      if (property in methods) return methods[property];
      if (property === "POINTS") return POINTS;
      // An unknown all-caps name is a GL constant; anything else is a method
      // the renderer calls and does not read the result of.
      if (/^[A-Z][A-Z0-9_]*$/.test(property)) {
        if (!constants.has(property)) constants.set(property, nextConstant++);
        return constants.get(property);
      }
      return () => undefined;
    },
  });
}
