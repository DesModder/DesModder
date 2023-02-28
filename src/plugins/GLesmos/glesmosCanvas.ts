import ViewportTransforms from "./ViewportTransforms";
import {
  GLesmosShaderChunk,
  GLesmosProgram,
  glesmosError,
  glesmosGetCacheShader,
  glesmosGetSDFShader,
  glesmosGetFinalPassShader,
  glesmosGetFastFillShader,
  setUniform,
} from "./shaders";

export type GLesmosCanvas = ReturnType<typeof initGLesmosCanvas>;

function createAndBindTexture(gl: WebGL2RenderingContext) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return tex;
}

const FULLSCREEN_QUAD = new Float32Array([
  -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
]);

export function initGLesmosCanvas() {
  //= ================ INIT ELEMENTS =======================

  const c: HTMLCanvasElement = document.createElement("canvas");
  const gl: WebGL2RenderingContext = c.getContext("webgl2", {
    // Disable premultiplied alpha
    // Thanks to <https://stackoverflow.com/a/12290551/7481517>
    premultipliedAlpha: false,
    antialias: true,
  }) as WebGL2RenderingContext;

  //= ================ INIT WEBGL STUFF ================

  gl.getExtension("EXT_color_buffer_float");

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  let ACTIVE_FB = 0; // all caps so I don't forget this is global

  const textures: (WebGLTexture | null)[] = [];
  const framebuffers: (WebGLFramebuffer | null)[] = [];

  // a "cache" buffer for storing the first pass of the shader madness
  const cacheTexture = createAndBindTexture(gl);
  const cacheFB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, cacheFB);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    cacheTexture,
    0
  );

  // 3 extra buffers for pingponging and feedback loop dodging
  for (let i = 0; i < 3; i++) {
    const tex = createAndBindTexture(gl);
    const fb = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );

    textures.push(tex);
    framebuffers.push(fb);
  }

  //= ================ SHADER OBJECTS ================

  let glesmosCache: GLesmosProgram | null;

  let glesmosSDF: GLesmosProgram | null;
  let glesmosSDFrequiredSteps: number;

  let glesmosFinalPass: GLesmosProgram | null;

  let glesmosFastFill: GLesmosProgram | null;

  //= ================ GRAPH BOUNDS ======================

  let cornerOfGraph = [-10, -6];
  let sizeOfGraph = [20, 12];

  //= ====================== RESIZING STUFF =======================

  const updateTransforms = (transforms: ViewportTransforms) => {
    const w = transforms.pixelCoordinates.right;
    const h = transforms.pixelCoordinates.bottom;
    const p2m = transforms.pixelsToMath;
    c.width = w;
    c.height = h;

    if (p2m.xScale.type !== "linear" || p2m.yScale.type !== "linear") {
      glesmosError("Unsupported transformation. Please use linear.");
    }

    gl.viewport(0, 0, c.width, c.height);

    glesmosSDFrequiredSteps = Math.ceil(Math.log2(Math.max(w, h)));

    cornerOfGraph = [p2m.xScale.t, p2m.yScale.s * h + p2m.yScale.t];
    sizeOfGraph = [p2m.xScale.s * w, -p2m.yScale.s * h];

    for (const tex of textures.concat(cacheTexture)) {
      // resize the framebuffer textures
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        null
      );
    }
  };

  const setupGLesmosEnvironment = (program: GLesmosProgram) => {
    // vertex buffer
    gl.enableVertexAttribArray(program.vertexAttribPos);
    gl.vertexAttribPointer(program.vertexAttribPos, 2, gl.FLOAT, false, 8, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

    // uniforms
    gl.uniform2fv(program.size, sizeOfGraph);
    gl.uniform2fv(program.corner, cornerOfGraph);
    gl.uniform1f(program.NaN, NaN);
    gl.uniform1f(program.Infinity, Infinity);
  };

  //= ================ WEBGL FUNCTIONS ================

  const buildGLesmosFancy = (deps: string, chunk: GLesmosShaderChunk) => {
    glesmosCache = glesmosGetCacheShader(gl, chunk, deps);
    glesmosFinalPass = glesmosGetFinalPassShader(gl, chunk);
    glesmosSDF = glesmosGetSDFShader(gl, chunk, deps); // we don't need to build this if we aren't drawing outlines
  };

  const buildGLesmosFast = (deps: string, chunks: GLesmosShaderChunk[]) => {
    glesmosFastFill = glesmosGetFastFillShader(gl, chunks, deps);
  };

  const runCacheShader = () => {
    if (!glesmosCache) glesmosError("Cache shader failed.");
    gl.useProgram(glesmosCache);
    setupGLesmosEnvironment(glesmosCache);

    gl.activeTexture(gl.TEXTURE1); // following texture operations concern texture 1
    gl.bindTexture(gl.TEXTURE_2D, cacheTexture); // texture 1 now points to cacheTexture
    gl.bindFramebuffer(gl.FRAMEBUFFER, cacheFB); // draw to cacheFB, which points to cacheTexture, which is on texture 1
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const runSDFShader = () => {
    if (!glesmosSDF) glesmosError("SDF shader failed.");
    gl.useProgram(glesmosSDF);
    ACTIVE_FB = 0;

    setupGLesmosEnvironment(glesmosSDF);

    gl.activeTexture(gl.TEXTURE1); // following texture operations concern texture 1
    gl.bindTexture(gl.TEXTURE_2D, cacheTexture); // texture 1 now points to cacheTexture

    gl.activeTexture(gl.TEXTURE0); // following texture operations concern texture 0
    gl.bindTexture(gl.TEXTURE_2D, null); // texture 0 now points to pingpong texture 0
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[ACTIVE_FB]); // draw to selected texture

    setUniform(gl, glesmosSDF, "c_maxSteps", "1f", glesmosSDFrequiredSteps);
    setUniform(gl, glesmosSDF, "iResolution", "2fv", [c.width, c.height]);
    setUniform(gl, glesmosSDF, "iInitFlag", "1i", 1);

    setUniform(gl, glesmosSDF, "iChannel0", "1i", 0); // probably not explicitly needed
    setUniform(gl, glesmosSDF, "iChannel1", "1i", 1);

    for (let i = 0; i < glesmosSDFrequiredSteps; i++) {
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      setUniform(gl, glesmosSDF, "iInitFlag", "1i", 0);

      gl.bindTexture(gl.TEXTURE_2D, textures[ACTIVE_FB]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1 - ACTIVE_FB]);

      setUniform(gl, glesmosSDF, "c_stepNum", "1f", i);
      ACTIVE_FB = 1 - ACTIVE_FB;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const runFinalPassShader = () => {
    if (!glesmosFinalPass) glesmosError("Outline pass shader failed.");
    gl.useProgram(glesmosFinalPass);
    setupGLesmosEnvironment(glesmosFinalPass);

    setUniform(gl, glesmosFinalPass, "iResolution", "2fv", [c.width, c.height]);
    setUniform(gl, glesmosFinalPass, "iChannel0", "1i", 0);
    setUniform(gl, glesmosFinalPass, "iChannel1", "1i", 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[2]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cacheTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // now draw directly to the screen!
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const runFastShader = () => {
    if (!glesmosFastFill) glesmosError("Fast-fill shader failed.");
    gl.useProgram(glesmosFastFill);
    setupGLesmosEnvironment(glesmosFastFill);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const renderFancy = () => {
    runCacheShader();
    runSDFShader();
    runFinalPassShader();
  };

  const renderFast = () => {
    runFastShader();
  };

  //= ================ CLEANUP ================

  const deleteCanvas = () => {
    c.parentElement?.removeChild(c);
  };

  //= ==================== CONSTRUCTED OBJECT ================
  return {
    element: c,
    glContext: gl,
    deleteCanvas,
    updateTransforms,
    buildGLesmosFancy,
    buildGLesmosFast,
    renderFancy,
    renderFast,
  };
}
