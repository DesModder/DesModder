export function glesmosError(msg: string): never {
  console.error(`[GLesmos Error] ${msg}`);
  throw Error(`[GLesmos Error] ${msg}`);
}

// NOTE: glesmos.replacements:212 must reflect any changes to this type, or you will get errors
export type GLesmosShaderPackage = {
  deps: string[]
  defs: string[]
  colors: string[]
  line_colors: string[]
  line_widths: number[]
};

export type GLesmosShaderChunks = {
  deps: string
  def: string
  color: string
  line_color: string
  line_width: number
};

// I introduced this to make things uniforms more type-safe
export type GLesmosProgram = WebGLProgram & {
  vertexAttribPos: number
  corner: WebGLUniformLocation | null
  size: WebGLUniformLocation | null
  NaN: WebGLUniformLocation | null
  Infinity: WebGLUniformLocation | null
};

type UniformType = '1f' | '2fv' | '3fv' | '4fv' | '1i'; // TODO: this isn't very typesafe!
export function setUniform(
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
  shaderProgram.corner   = gl.getUniformLocation(shaderProgram, 'graphCorner');
  shaderProgram.size     = gl.getUniformLocation(shaderProgram, 'graphSize');
  shaderProgram.NaN      = gl.getUniformLocation(shaderProgram, 'NaN');
  shaderProgram.Infinity = gl.getUniformLocation(shaderProgram, 'Infinity');
  
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
`

// = ===================== WebGL Source Generators ======================

export function glesmos_getCacheShader(gl: WebGL2RenderingContext, id:string, chunks: GLesmosShaderChunks): GLesmosProgram {

  const source = `${GLESMOS_ENVIRONMENT}
    // dependencies
    ${chunks.deps}

    // main func
    ${chunks.def}

    void main(){
      vec2 mathCoord = texCoord * graphSize + graphCorner;
      float v = _f0( mathCoord.x, mathCoord.y );
      outColor = vec4(v, 0, 0, 1);
    }
  `;

  const shader = getShaderProgram(
    gl,
    id,
    VERTEX_SHADER,
    source,
  );

  // TODO: set some uniforms here

  return shader;
}

export function glesmos_getSDFShader(gl: WebGL2RenderingContext, id:string, chunks: GLesmosShaderChunks): GLesmosProgram {

  const source = `${GLESMOS_ENVIRONMENT}
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
      float first = sign( f0_cache( fragCoord + Q_kernel[0] * 2.0 / iResolution ) );
      for( int i = 1; i < 4; i++ ){
        if( sign( f0_cache(fragCoord + Q_kernel[i] * 2.0 / iResolution) ) != first ){
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

  const shader = getShaderProgram(
    gl,
    id,
    VERTEX_SHADER,
    source,
  );

  return shader;

}

export function glesmos_getFinalPassShader(gl: WebGL2RenderingContext, id:string, chunks: GLesmosShaderChunks): GLesmosProgram {

  const source = `${GLESMOS_ENVIRONMENT}

    uniform sampler2D iChannel0;   // storage
    uniform sampler2D iChannel1;   // cache
    uniform vec2      iResolution; // canvas size
    uniform int       iDoOutlines;

    ${GLESMOS_SHARED}

    void main(){

      // fill
      vec4 test = getPixel( texCoord, iChannel1 );
      if( test.x > 0.0 ){
        outColor = mixColor(outColor, ${chunks.color});
      }

      // lines
      if( iDoOutlines != 1 ) return;
      vec4 JFA_undefined = vec4(-Infinity);
      vec2 warp = iResolution / max(iResolution.x, iResolution.y);

      vec4 seed = getPixel( texCoord, iChannel0 );

      if( seed == JFA_undefined ){ return; }

      float dist = LineSDF( seed * vec4(warp,warp), texCoord * warp ) * max(iResolution.x, iResolution.y);

      float alpha = smoothstep(0.0, 1.0, clamp( dist - float(${chunks.line_width}) * 0.5 + 0.5, 0.0, 1.0 ));
      outColor = mixColor(outColor, ${chunks.line_color} * vec4(1.0,1.0,1.0,1.0 - alpha));
    }
  `;

  const shader = getShaderProgram(
    gl,
    id,
    VERTEX_SHADER,
    source,
  );
  gl.useProgram(shader);
  setUniform(gl, shader, "iDoOutlines", "1i", chunks.line_width > 0 ? 1 : 0)

  return shader;

}