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
  line_color: string
  line_width: string
};

// NOTE: glesmos.replacements:205 must reflect any changes to this type, or you will get errors
export type GLesmosShaderPackage = {
  deps: string[]
  defs: string[]
  colors: string[]
  line_colors: string[]
  line_widths: string[]
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

vec2 toMathCoord(in vec2 fragCoord){
  return fragCoord * graphSize + graphCorner;
}
`;

const GLESMOS_SHARED = `
  vec4 getPixel( in vec2 coord, in sampler2D channel ){
    return texture( channel, coord );
  }

  float line_segment(in vec2 p, in vec2 a, in vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return length(pa - h * ba);
  }

  float LineSDF(in vec4 line, in vec2 p){
    return line_segment(p, vec2(line[0], line[1]), vec2(line[2], line[3]) );
  }
`

// = ===================== WebGL Source Generators ======================

function glesmos_Cache_Source(chunks: GLesmosShaderChunks) {
return `${GLESMOS_ENVIRONMENT}

// dependencies
${chunks.deps}

// main func
${chunks.def}

void main(){
  vec2 mathCoord = texCoord * graphSize + graphCorner;
  float v = _f0( mathCoord.x, mathCoord.y );
  outColor = vec4(v, 0, 0, 1);
}
`
}

function glesmos_SDF_Source(chunks: GLesmosShaderChunks) {
return `${GLESMOS_ENVIRONMENT}

uniform sampler2D iChannel0; // storage
uniform sampler2D iChannel1; // cache
uniform int       iInitFlag; // are we initializing?
uniform vec2      iResolution; // canvas size

uniform float     c_maxSteps;
uniform float     c_stepNum;

// dependencies
${chunks.deps}

// main func
${chunks.def}

//============== BEGIN Shared Stuff ==============//

${GLESMOS_SHARED}

//============== END Shared Stuff ==============//



//============== BEGIN JFA Helper Data ==============//

  const vec2 JFA_kernel[9] = vec2[9]( 
    vec2(-1.0,1.0)  , vec2(0.0,1.0)  , vec2(1.0,1.0)  ,
    vec2(-1.0,0.0)  , vec2(0.0,0.0)  , vec2(1.0,0.0)  ,
    vec2(-1.0,-1.0) , vec2(0.0,-1.0) , vec2(1.0,-1.0)
  );

  const vec2 Q_kernel[4] = vec2[4](
    vec2(-0.5,-0.5), vec2(0.5,-0.5),
    vec2(-0.5,0.5), vec2(0.5,0.5)
  );

  const vec2 D_kernel[4] = vec2[4](
    vec2(0,0), vec2(1,0),
    vec2(0,1), vec2(1,1)
  );

  // const vec4 JFA_undefined = vec4(-Infinity);

//============== END JFA Helper Data ==============//



//============== BEGIN Shadertoy Buffer A ==============//

float f0_cache( in vec2 fragCoord ){
  return getPixel( fragCoord, iChannel1).x;
}

vec2 d_f0( in vec2 fragCoord ){
  float px = f0_cache(fragCoord);
  return vec2( 
    px - f0_cache(fragCoord + vec2(1.0,0) / iResolution),
    px - f0_cache(fragCoord + vec2(0,1.0) / iResolution) 
  );
}

bool detectSignChange( in vec2 fragCoord ){
  float first = sign( f0_cache( fragCoord + Q_kernel[0] / iResolution ) );
  for( int i = 1; i < 4; i++ ){
    if( sign( f0_cache(fragCoord + Q_kernel[i] / iResolution) ) != first ){
      return true;
    }
  }
  return false;
}

vec4 lineToPixel(in vec2 p1, in vec2 p2, in vec2 fragCoord){
  return vec4( p1 + fragCoord, p2 + fragCoord );
}

vec2 quadTreeSolve( in vec2 seed, in float scale ){

  float closest = Infinity;
  int closest_n = 0;

  for( int n = 0; n < 4; n++ ){
    vec2 samplepos = toMathCoord(seed + Q_kernel[n] / iResolution * scale);
    float tmp = abs( _f0( samplepos.x, samplepos.y ) );
    if( tmp < closest ){
      closest_n = n;
      closest = tmp;
    }
  }
  
  return seed + Q_kernel[closest_n]  / iResolution * scale;
  
}

vec4 Step(in vec2 fragCoord){

  vec4 JFA_undefined = vec4(-Infinity);

  float stepwidth = floor(exp2(c_maxSteps - c_stepNum - 1.0));

  vec2 warp = iResolution / max(iResolution.x, iResolution.y);
  
  float bestDistance = Infinity;
  vec4  bestLine     = JFA_undefined;
  
  for (int n = 0; n < 9; n++) {
      
    vec2 sampleCoord = fragCoord + JFA_kernel[n] / iResolution * stepwidth;
    vec4 seed        = getPixel( sampleCoord, iChannel0 );

    if( seed == JFA_undefined ) continue; // don't try to use this one
    float dist = LineSDF( seed * vec4(warp,warp), fragCoord * warp );
    
    if (dist < bestDistance){
      bestDistance = dist;
      bestLine     = seed;
    }
          
  }
  
  return bestLine;
}

void main(){

  vec4 JFA_undefined = vec4(-Infinity);

  vec2 fragCoord = texCoord;
  
  if( iInitFlag == 1 ) {  // JFA initialization
    
    bool mask = detectSignChange( fragCoord ); // works correctly
    
    if( mask ){

      fragCoord = quadTreeSolve(fragCoord, 1.0);
      fragCoord = quadTreeSolve(fragCoord, 0.5);
      fragCoord = quadTreeSolve(fragCoord, 0.25);
      
      vec2 d = d_f0(fragCoord);
      d = normalize( vec2(-d.y, d.x) ) / iResolution;
      
      outColor = lineToPixel(-d, d, fragCoord);
    }
    else {
      outColor = JFA_undefined;
    }
      
  }
  else {  // JFA stepping
    outColor = Step( fragCoord );
  }
      
}

//============== END Shadertoy Buffer A ==============//

`;
}

function glesmos_OutlinePass_Source(chunks: GLesmosShaderChunks) {
return `${GLESMOS_ENVIRONMENT}

uniform sampler2D iChannel0; // storage
uniform vec2      iResolution; // canvas size

${GLESMOS_SHARED}

void main(){

  vec2 warp = iResolution / max(iResolution.x, iResolution.y);

  vec4 seed = getPixel( texCoord, iChannel0 );
  float dist = LineSDF( seed * vec4(warp,warp), texCoord * warp ) * max(iResolution.x, iResolution.y);

  float color = smoothstep( 0.0, 1.0, clamp( dist - 5.0, 0.0, 1.0 ));
  // outColor = vec4(1.0);
  // return;
  outColor = vec4( vec3(1.0 - color), 1.0 ); 
}
`
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

  let ACTIVE_FB = 0; // all caps so I don't forget this is global

  const textures: (WebGLTexture | null)[] = [];
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

  let glesmos_OutlinePass: GLesmosProgram | null;

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
    let shdbg = glesmos_SDF_Source(chunks);
    (window as any).shader_debug = shdbg
    glesmos_Cache = getShaderProgram(
      gl,
      id,
      VERTEX_SHADER,
      glesmos_Cache_Source(chunks),
    );

    glesmos_SDF = getShaderProgram(
      gl,
      id,
      VERTEX_SHADER,
      shdbg
    );

    glesmos_OutlinePass = getShaderProgram(
      gl,
      id,
      VERTEX_SHADER,
      glesmos_OutlinePass_Source(chunks)
    )
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

    if (!glesmos_OutlinePass) glesmosError('Outline pass shader failed.');
    gl.useProgram(glesmos_OutlinePass);   
    {
      setupGLesmosEnvironment(glesmos_OutlinePass);

      setUniform(gl, glesmos_OutlinePass, "iResolution", "2fv", [c.width, c.height]);
      setUniform(gl, glesmos_OutlinePass, "iChannel0", "1i", 0);

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
