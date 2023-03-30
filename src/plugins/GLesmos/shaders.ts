export function glesmosError(msg: string): never {
  console.error(`[GLesmos Error] ${msg}`);
  throw Error(`[GLesmos Error] ${msg}`);
}

// NOTE: glesmos.replacements:212 must reflect any changes to this type, or you will get errors
// (Replacement "Replace quadtree implicit tracing with glesmos compilation")
export interface GLesmosShaderPackage {
  deps: string[];
  chunks: GLesmosShaderChunk[];
  hasOutlines: boolean;
}

export interface GLesmosShaderChunk {
  main: string;
  dx: string;
  dy: string;
  fill: boolean;
  color: string;
  line_color: string;
  line_width: number;
}

// I introduced this to make things uniforms more type-safe
export type GLesmosProgram = WebGLProgram & {
  vertexAttribPos: number;
  corner: WebGLUniformLocation | null;
  size: WebGLUniformLocation | null;
  NaN: WebGLUniformLocation | null;
  Infinity: WebGLUniformLocation | null;
};

type UniformType = "1f" | "2fv" | "3fv" | "4fv" | "1i"; // TODO: this isn't very typesafe!
type UniformSetter = (
  location: WebGLUniformLocation | null,
  v: number | number[]
) => void;
export function setUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  uniformName: string,
  uniformType: UniformType,
  uniformValue: number | number[]
) {
  const uniformSetterKey: keyof WebGLRenderingContext = ("uniform" +
    uniformType) as keyof WebGLRenderingContext;
  (gl[uniformSetterKey] as UniformSetter)(
    gl.getUniformLocation(program, uniformName),
    uniformValue
  );
}

function compileShader(
  gl: WebGL2RenderingContext,
  shaderCode: string,
  type: number
) {
  const shader: WebGLShader | null = gl.createShader(type);
  if (shader === null) {
    glesmosError("Invalid shader type");
  }

  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderInfoLog = gl.getShaderInfoLog(shader);
    glesmosError(
      `While compiling ${
        type === gl.VERTEX_SHADER ? "vertex" : "fragment"
      } shader:
      ${shaderInfoLog ?? ""}`
    );
  }
  return shader;
}

function buildShaderProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string
) {
  const shaderProgram = gl.createProgram();
  if (shaderProgram === null) {
    glesmosError("Unable to create shader program!");
  }
  const vertexShader = compileShader(gl, vert, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, frag, gl.FRAGMENT_SHADER);
  if (vertexShader && fragmentShader) {
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    return shaderProgram;
  } else {
    glesmosError("One or more shaders did not compile.");
  }
}

const shaderCache = new Map<string, GLesmosProgram>();
function getShaderProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
) {
  const key = vertexSource + fragmentSource;
  const cachedShader = shaderCache.get(key); // TODO: hashing this whole thing is probably slow

  if (cachedShader) return cachedShader;

  const shaderProgram = buildShaderProgram(
    gl,
    vertexSource,
    fragmentSource
  ) as GLesmosProgram;

  shaderProgram.vertexAttribPos = gl.getAttribLocation(
    shaderProgram,
    "vertexPosition"
  );
  shaderProgram.corner = gl.getUniformLocation(shaderProgram, "graphCorner");
  shaderProgram.size = gl.getUniformLocation(shaderProgram, "graphSize");
  shaderProgram.NaN = gl.getUniformLocation(shaderProgram, "NaN");
  shaderProgram.Infinity = gl.getUniformLocation(shaderProgram, "Infinity");

  shaderCache.set(key, shaderProgram);
  if (shaderCache.size > 100) {
    const key = Array.from(shaderCache.keys())[0];
    shaderCache.delete(key);
  }

  return shaderProgram;
}

export const VERTEX_SHADER = `#version 300 es
in highp vec2 vertexPosition;
out vec2 texCoord;

void main() {
  texCoord    = vertexPosition * 0.5 + 0.5;
  gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
`;

export const GLESMOS_ENVIRONMENT = `#version 300 es
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

vec4 mixColor(vec4 from, vec4 top) {
  float a = 1.0 - (1.0 - from.a) * (1.0 - top.a);
  return vec4((from.rgb * from.a * (1.0 - top.a) + top.rgb * top.a) / a, a);
}
`;

export const GLESMOS_SHARED = `
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
`;

// = ===================== WebGL Source Generators ======================

export function glesmosGetCacheShader(
  gl: WebGL2RenderingContext,
  chunk: GLesmosShaderChunk,
  deps: string
): GLesmosProgram {
  const source = `${GLESMOS_ENVIRONMENT}
    // dependencies
    ${deps}

    // main implicit
    float f_xy(float x, float y){
      ${chunk.main}
    }

    void main(){
      vec2 mathCoord = texCoord * graphSize + graphCorner;
      float v = f_xy( mathCoord.x, mathCoord.y );
      outColor = vec4(v, 0, 0, 1);
    }
  `;

  const shader = getShaderProgram(gl, VERTEX_SHADER, source);

  // TODO: set some uniforms here

  return shader;
}

export function glesmosGetSDFShader(
  gl: WebGL2RenderingContext,
  chunk: GLesmosShaderChunk,
  deps: string
): GLesmosProgram {
  const source = `${GLESMOS_ENVIRONMENT}
    uniform sampler2D iChannel0; // storage
    uniform sampler2D iChannel1; // cache
    uniform int       iInitFlag; // are we initializing?
    uniform vec2      iResolution; // canvas size

    uniform float     c_maxSteps;
    uniform float     c_stepNum;

    //============== BEGIN GLesmos Imports ==============//

    // dependencies
    ${deps}

    // main implicit
    float f_xy(float x, float y){
      ${chunk.main}
    }
    float f_xy_p(in vec2 p){
      return f_xy(p.x, p.y);
    }

    // derivative stuff
    float f_dx(float x, float y){
      ${chunk.dx}
    }
    float f_dy(float x, float y){
      ${chunk.dy}
    }
    vec2 f_dxy(float x, float y){
      return vec2(
        f_dx(x, y),
        f_dy(x, y)
      );
    }
    vec2 f_dxy_p(in vec2 p){
      return f_dxy(p.x, p.y);
    }

    //============== END GLesmos Imports ==============//



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
        vec2(-0.5,0.5),  vec2(0.5,0.5),
        vec2(-0.5,-0.5), vec2(0.5,-0.5)
      );

      const vec2 D_kernel[4] = vec2[4](
        vec2(0,0), vec2(1,0),
        vec2(0,1), vec2(1,1)
      );

      // const vec4 JFA_undefined = vec4(-Infinity);

    //============== END JFA Helper Data ==============//



    //============== BEGIN Shadertoy Buffer A ==============//

    float f_xy_cache( in vec2 fragCoord ){
      return getPixel( fragCoord, iChannel1).x;
    }

    bool detectSignChange( in vec2 fragCoord ){

      vec2 mathcoord = toMathCoord(fragCoord);

      const vec4 identity = vec4(1,1,1,1);
      vec4 corners = vec4(
        f_xy_cache( (fragCoord + Q_kernel[0] / iResolution) ),
        f_xy_cache( (fragCoord + Q_kernel[1] / iResolution) ),
        f_xy_cache( (fragCoord + Q_kernel[2] / iResolution) ),
        f_xy_cache( (fragCoord + Q_kernel[3] / iResolution) )
      );

      vec4 corner_signs = sign(corners);

      // TEST 0: NaN -> no outlines!
      for(int i=0; i<4; i++){
        if( corners[i] != corners[i] ){ return false; }
      }

      // TEST 1: did we get extremely lucky and sample a zero directly?
      if( abs( dot(abs(corner_signs), identity) ) < 4.0 ){
        return true;
      }

      // TEST 2: was there a sign change? (if not, no outline)
      if( abs( dot(corner_signs, identity) ) == 4.0 ){
        return false;
      }

      // TEST 3: is this an asymptote like 1/x? (compare true derivative to an approximation)
      vec4 deriv_samples = vec4(
        (corners[1] - corners[0]), (corners[3] - corners[2]),
        (corners[0] - corners[2]), (corners[1] - corners[3]) 
      );
      vec2 derivative_approx = vec2(
        deriv_samples[0] * 0.5 + deriv_samples[1] * 0.5,
        deriv_samples[2] * 0.5 + deriv_samples[3] * 0.5 
      );

      vec2 derivative_real = f_dxy_p( toMathCoord(fragCoord) );
      return dot( normalize(derivative_real), normalize(derivative_approx) ) > 0.8; // if these are about the same, it probably isn't an asymptote

    }

    vec4 lineToPixel(in vec2 p1, in vec2 p2, in vec2 fragCoord){
      return vec4( p1 + fragCoord, p2 + fragCoord );
    }

    vec2 quadTreeSolve( in vec2 seed, in float scale ){

      float closest = Infinity;
      int closest_n = 0;

      for( int n = 0; n < 4; n++ ){
        vec2 samplepos = toMathCoord(seed + Q_kernel[n] / iResolution * scale);
        float tmp = abs( f_xy( samplepos.x, samplepos.y ) );
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
          
          vec2 mathCoord = fragCoord * graphSize + graphCorner;
          vec2 d = f_dxy(mathCoord.x, mathCoord.y);
          
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
  const shader = getShaderProgram(gl, VERTEX_SHADER, source);

  return shader;
}

export function glesmosGetFinalPassShader(
  gl: WebGL2RenderingContext,
  chunk: GLesmosShaderChunk
): GLesmosProgram {
  const source = `${GLESMOS_ENVIRONMENT}

    uniform sampler2D iChannel0;   // storage
    uniform sampler2D iChannel1;   // cache
    uniform vec2      iResolution; // canvas size
    uniform int       iDoOutlines;
    uniform int       iDoFill;

    ${GLESMOS_SHARED}

    void main(){

      // fill
      if ( iDoFill == 1 ) {
        vec4 test = getPixel( texCoord, iChannel1 );
        if( test.x > 0.0 ){
          outColor = mixColor(outColor, ${chunk.color});
        }
      }

      // lines
      if( iDoOutlines != 1 ) return;
      vec4 JFA_undefined = vec4(-Infinity);
      vec2 warp = iResolution / max(iResolution.x, iResolution.y);

      vec4 seed = getPixel( texCoord, iChannel0 );

      if( seed == JFA_undefined ){ return; }

      float dist = LineSDF( seed * vec4(warp,warp), texCoord * warp ) * max(iResolution.x, iResolution.y);

      float alpha = smoothstep(0.0, 1.0, clamp( dist - float(${chunk.line_width}) * 0.5 + 0.5, 0.0, 1.0 ));
      outColor = mixColor(outColor, ${chunk.line_color} * vec4(1.0,1.0,1.0,1.0 - alpha));
    }
  `;

  const shader = getShaderProgram(gl, VERTEX_SHADER, source);
  gl.useProgram(shader);
  setUniform(gl, shader, "iDoOutlines", "1i", chunk.line_width > 0 ? 1 : 0);
  setUniform(gl, shader, "iDoFill", "1i", chunk.fill ? 1 : 0);

  return shader;
}

export function glesmosGetFastFillShader(
  gl: WebGL2RenderingContext,
  chunks: GLesmosShaderChunk[],
  deps: string
): GLesmosProgram {
  const mains = chunks
    .map((chunk, id) => `float f_xy_${id}(float x, float y){ ${chunk.main} }`)
    .join("\n");

  const colorCalls = chunks
    .map(
      (chunk, id) => `if( f_xy_${id}( mathCoord.x, mathCoord.y ) > 0.0 ){
        outColor = mixColor(outColor, ${chunk.color});
      }`
    )
    .join("\n");

  const source = `${GLESMOS_ENVIRONMENT}
    ${GLESMOS_SHARED}

    ${deps}

    ${mains}

    void main(){
      vec2 mathCoord = texCoord * graphSize + graphCorner;
      ${colorCalls}
    }`;

  const shader = getShaderProgram(gl, VERTEX_SHADER, source);

  return shader;
}
