import { Calc } from "desmodder";
import ViewportTransforms from "./ViewportTransforms";

function showGLesmosError(msg: string) {
  console.error("GLesmos Error: " + msg);
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  shaderCode: string,
  type: number
) {
  let shader: WebGLShader | null = gl.createShader(type);
  if (shader === null) {
    showGLesmosError("Invalid shader type!");
    return;
  }

  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    showGLesmosError(
      `Error compiling ${
        type === gl.VERTEX_SHADER ? "vertex" : "fragment"
      } shader:`
    );
    let shaderInfoLog = gl.getShaderInfoLog(shader);
    showGLesmosError(shaderInfoLog ? shaderInfoLog : "");
  }
  return shader;
}

function buildShaderProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vert: string,
  frag: string
) {
  let shaderProgram = gl.createProgram();
  if (shaderProgram === null) {
    showGLesmosError("Unable to create shader program!");
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
    showGLesmosError("One or more shaders did not compile.");
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

export interface GLesmosCanvas {
  element: HTMLCanvasElement;
  glContext: WebGLRenderingContext;
  deleteCanvas(): void;
  updateTransforms(transforms: ViewportTransforms): void;
  setGLesmosShader(shader: string): void;
  render(): void;
}

const FULLSCREEN_QUAD = new Float32Array([
  -1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1,
]);

const VERTEX_SHADER = `

    attribute highp vec2 vertexPosition;

    varying vec2 texCoord;

    void main() {
        texCoord = vertexPosition * 0.5 + 0.5;
        gl_Position = vec4(vertexPosition, 0.0, 1.0);
    }
`;

const GLESMOS_FRAGMENT_SHADER = `
varying mediump vec2 texCoord;
precision highp float;

uniform vec2 corner;
uniform vec2 size;

//REPLACE_WITH_GLESMOS
vec4 outColor = vec4(0.0);
void glesmosMain(vec2 coords) {}
//REPLACE_WITH_GLESMOS_END

void main() {
    glesmosMain(texCoord * size + corner);
    gl_FragColor = outColor;
}

`;

export function initGLesmosCanvas(): GLesmosCanvas {
  //================= INIT ELEMENTS =======================
  let c: HTMLCanvasElement = document.createElement("canvas");
  let gl: WebGLRenderingContext = c.getContext("webgl", {
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

  let setGLesmosShader = (shaderCode: string) => {
    const shaderResult = GLESMOS_FRAGMENT_SHADER.replace(
      /\/\/REPLACE_WITH_GLESMOS[\s\S]*\/\/REPLACE_WITH_GLESMOS_END/g,
      shaderCode
    );
    console.log(shaderResult);
    glesmosShaderProgram = buildShaderProgram(gl, VERTEX_SHADER, shaderResult);
  };

  setGLesmosShader(`
    vec4 outColor = vec4(0.0);
    void glesmosMain(vec2 coords) {}
    `);

  let render = () => {
    if (glesmosShaderProgram) {
      gl.useProgram(glesmosShaderProgram);

      let vertexPositionAttribLocation = gl.getAttribLocation(
        glesmosShaderProgram,
        "vertexPosition"
      );
      setUniform(gl, glesmosShaderProgram, "corner", "2fv", cornerOfGraph);
      setUniform(gl, glesmosShaderProgram, "size", "2fv", sizeOfGraph);

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
      showGLesmosError("Shader failed!");
    }
  };

  render();

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
