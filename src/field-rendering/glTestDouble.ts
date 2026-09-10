/**
 * A WebGL2 stand-in, so the renderers' allocation and frame paths can be tested
 * without a GPU.
 *
 * Test-only: nothing in the plugin imports this, and it is never in the bundle.
 * It lives beside the renderers rather than in a test file because both of them
 * are tested against it, and two copies of a fake would drift into testing two
 * different WebGLs.
 */
export function fakeCanvas(gl: FakeGL) {
  return {
    width: 0,
    height: 0,
    clientWidth: 400,
    clientHeight: 300,
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

export interface FakeGL {
  counts: {
    createTexture: number;
    deleteTexture: number;
    pointsDrawn: number;
    /** Instances asked for by `drawArraysInstanced`, which is one per arrow. */
    instancesDrawn: number;
    linkProgram: number;
    viewports: number[][];
  };
  [key: string]: any;
}

/**
 * Just enough of WebGL2 to run the renderer's allocation and frame paths
 * headlessly. Every GL name resolves to a distinct number so the renderer's
 * enum comparisons still mean something, and the handful of methods whose
 * return value the renderer actually inspects are answered explicitly.
 */
export function fakeGL(): FakeGL {
  const counts = {
    createTexture: 0,
    deleteTexture: 0,
    pointsDrawn: 0,
    instancesDrawn: 0,
    linkProgram: 0,
    viewports: [] as number[][],
  };
  // Well clear of POINTS, so no generated constant can collide with it.
  let nextConstant = 1000;
  const constants = new Map<string, number>();
  const POINTS = 100;
  const noop = () => {};

  const methods: Record<string, (...args: any[]) => any> = {
    getExtension: (name: string) =>
      name === "WEBGL_lose_context" ? { loseContext: () => {} } : {},
    createBuffer: () => ({}),
    createVertexArray: () => ({}),
    isContextLost: () => false,
    linkProgram: () => counts.linkProgram++,
    createFramebuffer: () => ({}),
    createShader: () => ({}),
    createProgram: () => ({}),
    createTexture: () => {
      counts.createTexture++;
      return {};
    },
    deleteTexture: () => counts.deleteTexture++,
    getShaderParameter: () => true,
    getProgramParameter: (_program: unknown, pname: number) =>
      pname === constants.get("ACTIVE_UNIFORMS") ? 0 : true,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    getShaderInfoLog: () => "",
    getProgramInfoLog: () => "",
    viewport: (...box: number[]) => counts.viewports.push(box),
    drawArrays: (mode: number, _first: number, count: number) => {
      if (mode === POINTS) counts.pointsDrawn += count;
    },
    drawArraysInstanced: (
      _mode: number,
      _first: number,
      _count: number,
      instances: number
    ) => {
      counts.instancesDrawn += instances;
    },
  };

  const context: FakeGL = { counts };
  return new Proxy(context, {
    get(target, property) {
      if (typeof property !== "string") return undefined;
      if (property === "counts") return target.counts;
      if (property in methods) return methods[property];
      // GL constants are the SHOUTING names; anything else is a method whose
      // return value the renderer does not look at, so a no-op will do.
      if (!/^[A-Z0-9_]+$/.test(property)) return noop;
      // POINTS has to keep the value drawArrays is checked against; every other
      // name only needs to be distinct.
      if (property === "POINTS") return POINTS;
      if (!constants.has(property)) constants.set(property, ++nextConstant);
      return constants.get(property);
    },
  });
}
