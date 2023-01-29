import ViewportTransforms from './ViewportTransforms';

import { 
  GLesmosShaderChunks, GLesmosProgram, glesmosError,
  glesmos_getCacheShader, glesmos_getSDFShader, glesmos_getOutlineShader
} from './shaders';

export type GLesmosCanvas = ReturnType<typeof initGLesmosCanvas>;


function createAndBindTexture(
  gl: WebGL2RenderingContext
) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return tex;
}

type UniformType = '1f' | '2fv' | '3fv' | '4fv' | '1i'; // TODO: this isn't very typesafe!
function setUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  uniformName: string,
  uniformType: UniformType,
  uniformValue: number | number[],
) {
  const uniformSetterKey: keyof WebGLRenderingContext = ('uniform' + uniformType) as keyof WebGLRenderingContext;
  (gl[uniformSetterKey] as Function)(
    gl.getUniformLocation(program, uniformName),
    uniformValue,
  )
};

const FULLSCREEN_QUAD = new Float32Array([
  -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
]);

// NOTE: glesmos.replacements:212 must reflect any changes to this type, or you will get errors
export type GLesmosShaderPackage = {
  deps: string[]
  defs: string[]
  colors: string[]
  line_colors: string[]
  line_widths: string[]
};

export function initGLesmosCanvas() {

  //= ================ INIT ELEMENTS =======================

  const c: HTMLCanvasElement = document.createElement('canvas');
  const gl: WebGL2RenderingContext = c.getContext('webgl2', {
    // Disable premultiplied alpha
    // Thanks to <https://stackoverflow.com/a/12290551/7481517>
    premultipliedAlpha: false,
    antialias: true,
  }) as WebGL2RenderingContext

  //= ================ INIT WEBGL STUFF ================

  gl.getExtension("EXT_color_buffer_float");

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  let ACTIVE_FB = 0; // all caps so I don't forget this is global

  const textures:     (WebGLTexture | null)[]     = [];
  const framebuffers: (WebGLFramebuffer | null)[] = [];

  // a "cache" buffer for storing the first pass of the shader madness
  const cacheTexture = createAndBindTexture(gl);
  const cacheFB      = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, cacheFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cacheTexture, 0);

  // 3 extra buffers for pingponging and feedback loop dodging
  for (let i = 0; i < 3; i++) {
    const tex = createAndBindTexture(gl);
    const fb  = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    textures.push(tex);
    framebuffers.push(fb);
  }

  //= ================ SHADER OBJECTS ================

  let glesmos_Cache: GLesmosProgram | null;

  let glesmos_SDF: GLesmosProgram | null;
  let glesmos_SDF_requiredSteps: number;

  let glesmos_Outline: GLesmosProgram | null;

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

    gl.viewport(0, 0, c.width, c.height);

    glesmos_SDF_requiredSteps = Math.ceil(Math.log2(Math.max(w, h)));

    cornerOfGraph = [p2m.tx, p2m.sy * h + p2m.ty];
    sizeOfGraph = [p2m.sx * w, -p2m.sy * h];

    for (const tex of textures) { // resize the framebuffer textures
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    }

    // resize the cache
    gl.bindTexture(gl.TEXTURE_2D, cacheTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);    
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

  const buildGLesmosShaders = (id: string, chunks: GLesmosShaderChunks) => {

    glesmos_Cache   = glesmos_getCacheShader(gl, id, chunks);
    glesmos_SDF     = glesmos_getSDFShader(gl, id, chunks);
    glesmos_Outline = glesmos_getOutlineShader(gl, id, chunks);

  };

  const draw = () => {

    if (!glesmos_Cache) glesmosError('Cache shader failed.');
    gl.useProgram(glesmos_Cache);
    {

      setupGLesmosEnvironment(glesmos_Cache);
      
      gl.activeTexture(gl.TEXTURE1);               // following texture operations concern texture 1
      gl.bindTexture(gl.TEXTURE_2D, cacheTexture); // texture 1 now points to cacheTexture
      gl.bindFramebuffer(gl.FRAMEBUFFER, cacheFB); // draw to cacheFB, which points to cacheTexture, which is on texture 1
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
    }

    if (!glesmos_SDF) glesmosError('SDF shader failed.');
    gl.useProgram(glesmos_SDF);   
    {

      ACTIVE_FB = 0;

      setupGLesmosEnvironment(glesmos_SDF);

      gl.activeTexture(gl.TEXTURE1);               // following texture operations concern texture 1
      gl.bindTexture(gl.TEXTURE_2D, cacheTexture); // texture 1 now points to cacheTexture

      gl.activeTexture(gl.TEXTURE0);               // following texture operations concern texture 0
      gl.bindTexture(gl.TEXTURE_2D, null);         // texture 0 now points to pingpong texture 0
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[ACTIVE_FB]); // draw to selected texture

      setUniform(gl, glesmos_SDF, "c_maxSteps", "1f", glesmos_SDF_requiredSteps);
      setUniform(gl, glesmos_SDF, "iResolution", "2fv", [c.width, c.height]);
      setUniform(gl, glesmos_SDF, "iInitFlag", "1i", 1);

      setUniform(gl, glesmos_SDF, "iChannel0", "1i", 0); // probably not explicitly needed
      setUniform(gl, glesmos_SDF, "iChannel1", "1i", 1);

      for (let i = 0; i < glesmos_SDF_requiredSteps; i++) {

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        setUniform(gl, glesmos_SDF, "iInitFlag", "1i", 0);

        gl.bindTexture(gl.TEXTURE_2D, textures[ACTIVE_FB]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1-ACTIVE_FB]);

        setUniform(gl, glesmos_SDF, "c_stepNum", "1f", i);
        ACTIVE_FB = 1 - ACTIVE_FB;

      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
    }
    gl.useProgram(null);

    if (!glesmos_Outline) glesmosError('Outline pass shader failed.');
    gl.useProgram(glesmos_Outline);   
    {
      setupGLesmosEnvironment(glesmos_Outline);

      setUniform(gl, glesmos_Outline, "iResolution", "2fv", [c.width, c.height]);
      setUniform(gl, glesmos_Outline, "iChannel0", "1i", 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[2]);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // now draw directly to the screen!
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };

  const render = () => {
    draw();
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
    buildGLesmosShaders,
    render,
  };
}
