import ViewportTransforms from './ViewportTransforms';

export type GLesmosCanvas = ReturnType<typeof initGLesmosCanvas>;


function glesmosError(msg: string): never {
  console.error(`[GLesmos Error] ${msg}`);
  throw Error(`[GLesmos Error] ${msg}`);
}

function compileShader(
  gl: WebGL2RenderingContext,
  shaderCode: string,
  type: number,
) {
  const shader: WebGLShader | null = gl.createShader(type);
  if (shader === null) {
    glesmosError('Invalid shader type');
  }

  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderInfoLog = gl.getShaderInfoLog(shader);
    glesmosError(
      `While compiling ${
        type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
      } shader:
      ${shaderInfoLog ?? ''}`,
    )
  }
  return shader;
}

function buildShaderProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
  _id: string,
) {
  // console.group('buildShaderProgram');
  // console.log('vert: %c\n' + vert, 'color: #fc83fc;');
  // console.log('frag: %c\n' + frag, 'color: #fc83fc;');
  // console.groupEnd();
  const shaderProgram = gl.createProgram();
  if (shaderProgram === null) {
    glesmosError('Unable to create shader program!');
  }
  const vertexShader = compileShader(gl, vert, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, frag, gl.FRAGMENT_SHADER);
  if (vertexShader && fragmentShader) {
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    return shaderProgram;
  } else {
    glesmosError('One or more shaders did not compile.');
  }
}

// I introduced this to make things uniforms more type-safe
type GLesmosProgram = WebGLProgram & {
  vertexAttribPos: number
  corner: WebGLUniformLocation | null
  size: WebGLUniformLocation | null
  NaN: WebGLUniformLocation | null
  Infinity: WebGLUniformLocation | null
};

const shaderCache = new Map<string, GLesmosProgram>();
function getShaderProgram(
  gl: WebGL2RenderingContext,
  id: string,
  vertexSource: string,
  fragmentSource: string,
) {
  let key = vertexSource + fragmentSource; // TODO: this is terrible
  const cachedShader = shaderCache.get(key);

  if (cachedShader) return cachedShader;

  const shaderProgram = buildShaderProgram(
    gl,
    vertexSource,
    fragmentSource,
    id,
  ) as GLesmosProgram

  shaderProgram.vertexAttribPos = gl.getAttribLocation(
    shaderProgram,
    'vertexPosition',
  );
  shaderProgram.corner = gl.getUniformLocation(shaderProgram, 'graphCorner');
  shaderProgram.size = gl.getUniformLocation(shaderProgram, 'graphSize');
  shaderProgram.NaN = gl.getUniformLocation(shaderProgram, 'NaN');
  shaderProgram.Infinity = gl.getUniformLocation(shaderProgram, 'Infinity');
  
  shaderCache.set(key, shaderProgram);
  if (shaderCache.size > 100) {
    const key = Array.from(shaderCache.keys())[0];
    gl.deleteShader(shaderCache.get(key) as WebGLProgram); // avoid another memory leak
    shaderCache.delete(key);
  }

  return shaderProgram;
}

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

type GLesmosShaderChunks = {
  deps: string
  def: string
  color: string
};

// NOTE: glesmos.replacements:205 must reflect any changes to this type, or you will get errors
export type GLesmosShaderPackage = {
  deps: string[]
  defs: string[]
  colors: string[]
};

// = ====================== Constant WebGL Code Components ======================

const VERTEX_SHADER = `#version 300 es
in highp vec2 vertexPosition;
out vec2 texCoord;

void main() {
  texCoord    = vertexPosition * 0.5 + 0.5;
  gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
`;

const GLESMOS_ENVIRONMENT = `#version 300 es
precision highp float;
in  vec2 texCoord;
out vec4 outColor;

uniform vec2  graphCorner;
uniform vec2  graphSize;
uniform float NaN;
uniform float Infinity;

#define M_PI 3.1415926535897932384626433832795
#define M_E 2.71828182845904523536028747135266
`;

const MERGE_SHADER = `${GLESMOS_ENVIRONMENT}

uniform sampler2D positive;
uniform sampler2D negative;
uniform float     radius;

float JFA_getDistance( in vec4 jfa ){
  return jfa[2];
}

void main(){
  float dist1 = JFA_getDistance( texture(negative, texCoord) );
  float dist2 = JFA_getDistance( texture(positive, texCoord) );

  float dist = max(dist1, dist2);
  float alpha = clamp( (radius + 1.0)*0.5 - dist, 0.0, 1.0 );
  outColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;

// = ===================== WebGL Source Generators ======================

function glesmos_SDF_Source(chunks: GLesmosShaderChunks) {
return `${GLESMOS_ENVIRONMENT}

uniform sampler2D sampler;
uniform int       setupMode;
uniform float     c_maxSteps;
uniform float     c_stepNum;
uniform float     direction;
uniform vec2      canvasSize;

// dependencies
${chunks.deps}

// main func
${chunks.def}

//= =================== JFA Helpers ===================
const vec2 JFA_kernel[9] = vec2[9]( 
  vec2(-1.0,1.0)  , vec2(0.0,1.0)  , vec2(1.0,1.0)  ,
  vec2(-1.0,0.0)  , vec2(0.0,0.0)  , vec2(1.0,0.0)  ,
  vec2(-1.0,-1.0) , vec2(0.0,-1.0) , vec2(1.0,-1.0)
);

const vec4 JFA_undefined = vec4(0.0);

vec4 newJFA (in vec2 seed, in float dist){
  vec4 jfa = vec4(0.0);
  jfa.xy = seed;
  jfa[2] = dist;
  jfa[3] = 1.0;  // a valid jfa object
  return jfa;
}

bool JFA_isUndefined( in vec4 jfa ){
  return jfa[3] == 0.0;
}

vec2 JFA_getSeed( in vec4 jfa ){
  return jfa.xy;
}

float JFA_getDistance( in vec4 jfa ){
  return jfa[2];
}

//= =================== JFA Main ===================

vec4 Setup(in vec2 mathCoord){
  if( _f0(mathCoord.x, mathCoord.y) * direction > 0.0 ) return newJFA(mathCoord, 0.0);
  else return vec4(0.0);
}

vec4 Step(in vec2 texCoord, in vec2 mathCoord){

  float stepwidth = floor( exp2(c_maxSteps - c_stepNum) - 1.0 );
  float maxSize = exp2(c_maxSteps);
  
  float bestDistance = 9999.0;
  vec2  bestCoord    = vec2(0.0);
  
  for (int n = 0; n < 9; n++) {
    
    vec2 sampleCoord = texCoord + JFA_kernel[n] / maxSize * stepwidth;
    vec4 jfa         = texture( sampler, sampleCoord );

    if( JFA_isUndefined(jfa) ) continue;
    
    vec2  seed = JFA_getSeed(jfa);
    float dist = length( (seed - mathCoord) * canvasSize / graphSize );
    
    if (dist < bestDistance){
      bestDistance = dist;
      bestCoord    = seed;
    }
  
  }
 
  return newJFA(bestCoord, bestDistance);
}

//= =================== Output ===================
void main(){
  vec2 mathCoord = texCoord * graphSize + graphCorner;

  if ( setupMode == 1 ){
    outColor = Setup( mathCoord );
  }
  else {
    outColor = Step( texCoord, mathCoord );
  }
}
`;
}

export function initGLesmosCanvas() {
  //= ================ INIT ELEMENTS =======================

  const c: HTMLCanvasElement = document.createElement('canvas');
  const gl: WebGL2RenderingContext = c.getContext('webgl2', {
    // Disable premultiplied alpha
    // Thanks to <https://stackoverflow.com/a/12290551/7481517>
    premultipliedAlpha: false,
    antialias: true,
  }) as WebGL2RenderingContext

  gl.getExtension("EXT_color_buffer_float");

  //= ================ INIT WEBGL STUFF ================

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  const initialTexture = createAndBindTexture(gl);

  const textures: (WebGLTexture | null)[] = [];
  const framebuffers: (WebGLFramebuffer | null)[] = [];
  let activeFb = 0;
  for (let i = 0; i < 4; i++) {
    const tex = createAndBindTexture(gl);
    const fb  = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    textures.push(tex);
    framebuffers.push(fb);
  }

  //= ================ SHADER OBJECTS ================

  let glesmos_SDF: GLesmosProgram | null;
  let glesmos_SDF_requiredSteps: number;

  const glesmos_mergeSDFs = getShaderProgram(gl, "lol", VERTEX_SHADER, MERGE_SHADER);

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
    gl.bindTexture(gl.TEXTURE_2D, initialTexture);
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
    console.log('setGLesmosShader');
    glesmos_SDF = getShaderProgram(
      gl,
      id,
      VERTEX_SHADER,
      glesmos_SDF_Source(chunks),
    );
  };

  const drawSDF = (direction: number, resultLocation: number) => {
    if (!glesmos_SDF) glesmosError('SDF shader failed.');

    gl.useProgram(glesmos_SDF);
    {

      activeFb = 0;

      setupGLesmosEnvironment(glesmos_SDF);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[activeFb]); // draw to texture 0
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      setUniform(gl, glesmos_SDF, "c_maxSteps", "1f", glesmos_SDF_requiredSteps);
      setUniform(gl, glesmos_SDF, "direction", "1f", direction);
      setUniform(gl, glesmos_SDF, "canvasSize", "2fv", [c.width, c.height]);
      setUniform(gl, glesmos_SDF, "setupMode", "1i", 1);
      
      for (let i = 0; i < glesmos_SDF_requiredSteps; i++) {

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        setUniform(gl, glesmos_SDF, "setupMode", "1i", 0);

        gl.bindTexture(gl.TEXTURE_2D, textures[activeFb]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1-activeFb]);

        setUniform(gl, glesmos_SDF, "c_stepNum", "1f", i);
        activeFb = 1 - activeFb;

      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[resultLocation]); // dump output to a texture
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
    }
    gl.useProgram(null);

  };

  const mergeSDFs = () => {
    if (!glesmos_mergeSDFs) glesmosError('SDF shader failed.');

    gl.useProgram(glesmos_mergeSDFs);
    {

      setupGLesmosEnvironment(glesmos_mergeSDFs);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[2]);
      setUniform(gl, glesmos_mergeSDFs, "positive", "1i", 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textures[3]);
      setUniform(gl, glesmos_mergeSDFs, "positive", "1i", 1);

      setUniform(gl, glesmos_mergeSDFs, "radius", "1f", 5.0); // test radius

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

    }
    gl.useProgram(null);

  };

  const render = () => {
    drawSDF(+1.0, 2);
    drawSDF(-1.0, 3);
    mergeSDFs();
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
