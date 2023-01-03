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
  console.group('buildShaderProgram');
  console.log('vert: %c\n' + vert, 'color: #fc83fc;');
  console.log('frag: %c\n' + frag, 'color: #fc83fc;');
  console.groupEnd();
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
  shaderProgram.corner = gl.getUniformLocation(shaderProgram, 'corner');
  shaderProgram.size = gl.getUniformLocation(shaderProgram, 'size');
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
  texCoord = vertexPosition * 0.5 + 0.5;
  gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
`;

const BUFFER_COPY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D sampler;
in vec2 texCoord;
out vec4 outColor;

void main(){
  outColor = texture(sampler, texCoord);
}
`;

const GLESMOS_ENVIRONMENT = `#version 300 es
precision highp float;
in vec2 texCoord;
out vec4 outColor;

uniform vec2 corner;
uniform vec2 size;
uniform float NaN;
uniform float Infinity;

#define M_PI 3.1415926535897932384626433832795
#define M_E 2.71828182845904523536028747135266
`;

// = ===================== WebGL Source Generators ======================

function glesmos_SDF_Source(chunks: GLesmosShaderChunks) {
return `${GLESMOS_ENVIRONMENT}

uniform sampler2D sampler;
uniform int       setupMode;
uniform float     c_maxSteps;
uniform float     c_stepNum;
uniform float     direction;

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

vec4 getPixel( in vec2 coord ){
  return texture( sampler, (coord - corner) / size );
}

vec4 Setup(in vec2 fragCoord){
  vec2 transform = fragCoord * size + corner;

  if( _f0(transform.x, transform.y) * direction > 0.0 ) return newJFA(fragCoord, 0.0);
  else return vec4(0.0);
}

vec4 Step(in vec2 fragCoord){

  float stepwidth = floor( exp2(c_maxSteps - c_stepNum)-1.0 );
  
  float bestDistance = 9999.0;
  vec2  bestCoord    = vec2(0.0);
  
  for (int n = 0; n < 9; n++) {
    
    vec2 sampleCoord = fragCoord + JFA_kernel[n] * stepwidth;
    vec4 jfa         = getPixel( sampleCoord );

    if( JFA_isUndefined(jfa) ) continue;
    
    vec2  seed = JFA_getSeed(jfa);
    float dist = length( seed - fragCoord );
    
    if (dist < bestDistance){
      bestDistance = dist;
      bestCoord    = seed;
    }
  
  }
 
  return newJFA(bestCoord, bestDistance);
}

//= =================== Output ===================
void main(){
  if ( setupMode == 1 ){
    outColor = Setup( texCoord * size + corner );
  }
  else if( setupMode == 0 ){
    outColor = Step( texCoord * size + corner );
  }
  else{
    vec4 jfa = getPixel( texCoord * size + corner );
    float dist = JFA_getDistance(jfa);
    vec3 color = vec3( clamp(3.0-dist,0.0,1.0) );
    outColor = vec4(color, 1.0);
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
  for (let i = 0; i < 2; i++) {
    const tex = createAndBindTexture(gl);
    const fb  = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    textures.push(tex);
    framebuffers.push(fb);
  }

  //= ================ SHADER OBJECTS ================

  let glesmos_SDF: GLesmosProgram | null;
  const glesmos_BufferCopy = buildShaderProgram(gl, VERTEX_SHADER, BUFFER_COPY_SHADER, "lol");
  let glesmos_SDF_requiredSteps: number;

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

  const drawSDF1 = () => {
    if (!glesmos_SDF) glesmosError('SDF shader failed.');

    gl.useProgram(glesmos_SDF);
    {

      activeFb = 0;

      setupGLesmosEnvironment(glesmos_SDF);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[activeFb]); // draw to texture 0
      
      setUniform(gl, glesmos_SDF, "c_maxSteps", "1f", glesmos_SDF_requiredSteps);
      setUniform(gl, glesmos_SDF, "direction", "1f", +1.0);

      setUniform(gl, glesmos_SDF, "setupMode", "1i", 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      setUniform(gl, glesmos_SDF, "setupMode", "1i", 0);
      
      for (let i = 0; i < glesmos_SDF_requiredSteps; i++) {

        gl.bindTexture(gl.TEXTURE_2D, textures[activeFb]);
        activeFb = 1 - activeFb;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[activeFb]);
        setUniform(gl, glesmos_SDF, "c_stepNum", "1f", i);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // now draw to the screen
      setUniform(gl, glesmos_SDF, "setupMode", "1i", -1); // debug jfa
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
    }
    gl.useProgram(null);

  };

  const render = () => {
    drawSDF1();
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
