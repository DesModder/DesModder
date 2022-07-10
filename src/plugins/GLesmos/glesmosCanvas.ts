import ViewportTransforms from "./ViewportTransforms";

function glesmosError(msg: string) {
  throw Error(`[GLesmos Error] ${msg}`);
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  shaderCode: string,
  type: number
) {
  let shader: WebGLShader | null = gl.createShader(type);
  if (shader === null) {
    throw glesmosError("Invalid shader type");
  }

  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    let shaderInfoLog = gl.getShaderInfoLog(shader);
    throw glesmosError(
      `While compiling ${
        type === gl.VERTEX_SHADER ? "vertex" : "fragment"
      } shader:
      ${shaderInfoLog ?? ""}`
    );
  }
  return shader;
}

function buildShaderProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vert: string,
  frag: string,
  id: string
) {
  let shaderProgram = gl.createProgram();
  if (shaderProgram === null) {
    throw glesmosError("Unable to create shader program!");
    return;
  }
  let vertexShader = compileShader(gl, vert, gl.VERTEX_SHADER);
  let fragmentShader = compileShader(gl, frag, gl.FRAGMENT_SHADER);
  if (vertexShader && fragmentShader) {
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    return shaderProgram;
  } else {
    throw glesmosError("One or more shaders did not compile.");
  }
}

type UniformType = "1f" | "2fv" | "3fv" | "4fv";

function setUniform(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  program: WebGLProgram,
  uniformName: string,
  uniformType: UniformType,
  uniformValue: number | number[]
) {
  let uniformSetterKey: keyof WebGLRenderingContext = ("uniform" +
    uniformType) as keyof WebGLRenderingContext;
  (gl[uniformSetterKey] as Function)(
    gl.getUniformLocation(program, uniformName),
    uniformValue
  );
}

export type GLesmosCanvas = ReturnType<typeof initGLesmosCanvas>;

const FULLSCREEN_QUAD = new Float32Array([
  -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
]);

const VERTEX_SHADER = `#version 300 es

in highp vec2 vertexPosition;
out vec2 texCoord;

void main() {
    texCoord = vertexPosition * 0.5 + 0.5;
    gl_Position = vec4(vertexPosition, 0.0, 1.0);
}
`;

const GLESMOS_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 texCoord;
out vec4 outColor;

uniform vec2 corner;
uniform vec2 size;
uniform float NaN;
uniform float Infinity;

#define M_PI 3.1415926535897932384626433832795
#define M_E 2.71828182845904523536028747135266

//REPLACE_WITH_GLESMOS
void glesmosMain(vec2 coords) {}
//REPLACE_WITH_GLESMOS_END

void main() {
    glesmosMain(texCoord * size + corner);
}

`;

export function initGLesmosCanvas() {
  //================= INIT ELEMENTS =======================
  let c: HTMLCanvasElement = document.createElement("canvas");
  let gl: WebGLRenderingContext = c.getContext("webgl2", {
    // Disable premultiplied alpha
    // Thanks to <https://stackoverflow.com/a/12290551/7481517>
    premultipliedAlpha: false,
  }) as WebGLRenderingContext;

  //================= GRAPH BOUNDS ======================
  let cornerOfGraph = [-10, -6];
  let sizeOfGraph = [20, 12];

  //======================= RESIZING STUFF =======================

  let updateTransforms = (transforms: ViewportTransforms) => {
    const w = transforms.pixelCoordinates.right;
    const h = transforms.pixelCoordinates.bottom;
    const p2m = transforms.pixelsToMath;
    c.width = w;
    c.height = h;
    gl.viewport(0, 0, c.width, c.height);
    cornerOfGraph = [p2m.tx, p2m.sy * h + p2m.ty];
    sizeOfGraph = [p2m.sx * w, -p2m.sy * h];
  };

  //============================ WEBGL STUFF ==========================
  let fullscreenQuadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  let glesmosShaderProgram: WebGLProgram | undefined;

  let setGLesmosShader = (shaderCode: string, id: string) => {
    const shaderResult = GLESMOS_FRAGMENT_SHADER.replace(
      /\/\/REPLACE_WITH_GLESMOS[\s\S]*\/\/REPLACE_WITH_GLESMOS_END/g,
      shaderCode
    );
    glesmosShaderProgram = buildShaderProgram(
      gl,
      VERTEX_SHADER,
      shaderResult,
      id
    );
  };

  let render = (id: string) => {
    if (glesmosShaderProgram) {
      gl.useProgram(glesmosShaderProgram);

      let vertexPositionAttribLocation = gl.getAttribLocation(
        glesmosShaderProgram,
        "vertexPosition"
      );
      setUniform(gl, glesmosShaderProgram, "corner", "2fv", cornerOfGraph);
      setUniform(gl, glesmosShaderProgram, "size", "2fv", sizeOfGraph);
      setUniform(gl, glesmosShaderProgram, "NaN", "1f", NaN);
      setUniform(gl, glesmosShaderProgram, "Infinity", "1f", Infinity);

      gl.enableVertexAttribArray(vertexPositionAttribLocation);
      gl.vertexAttribPointer(
        vertexPositionAttribLocation,
        2,
        gl.FLOAT,
        false,
        8,
        0
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else {
      throw glesmosError("Shader failed");
    }
  };

  //================= CLEANUP =============

  let deleteCanvas = () => {
    c.parentElement?.removeChild(c);
  };

  //===================== CONSTRUCTED OBJECT ============
  return {
    element: c,
    glContext: gl,
    deleteCanvas,
    updateTransforms: updateTransforms,
    setGLesmosShader: setGLesmosShader,
    render: render,
  };
}
