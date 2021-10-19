import { Calc } from "desmodder";

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
  resizeCanvas(w: number, h: number): void;
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

const TEST_FRAGMENT_SHADER = `

varying mediump vec2 texCoord;

void main() {
    gl_FragColor = vec4(texCoord.xy, 0.0, 1.0);
}

`;

const GLESMOS_FRAGMENT_SHADER = `
varying mediump vec2 texCoord;
precision highp float;

uniform vec2 corner;
uniform vec2 size;

//REPLACE_WITH_GLESMOS
vec4 outColor = vec4(1.0);
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
  let gl: WebGLRenderingContext = c.getContext(
    "webgl"
  ) as WebGLRenderingContext;

  let container: HTMLDivElement = document.createElement("div");
  container.appendChild(c);
  container.style.resize = "both";
  container.style.padding = "10px";
  container.style.position = "absolute";
  container.style.bottom = "0px";
  container.style.right = "0px";
  container.style.zIndex = "999999";

  document.body.appendChild(container);

  //================= GRAPH BOUNDS ======================
  let cornerOfGraph = [-10, -6];
  let sizeOfGraph = [20, 12];

  //======================= RESIZING STUFF =======================
  let resizeCanvas = (w: number, h: number) => {
    c.width = w;
    c.height = h;
    gl.viewport(0, 0, c.width, c.height);
  };

  window.addEventListener("resize", () => {
    resizeCanvas(window.innerWidth * 0.25, window.innerHeight * 0.25);
  });
  resizeCanvas(window.innerWidth * 0.25, window.innerHeight * 0.25);

  Calc.observe("graphpaperBounds", () => {
    let bounds = Calc.graphpaperBounds.mathCoordinates;
    cornerOfGraph = [bounds.left, bounds.bottom];
    sizeOfGraph = [bounds.width, bounds.height];
    requestAnimationFrame(render);
  });

  //============================ WEBGL STUFF ==========================
  let fullscreenQuadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  let testShaderProgram = buildShaderProgram(
    gl,
    VERTEX_SHADER,
    TEST_FRAGMENT_SHADER
  );

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
    vec4 outColor = vec4(1.0);
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
    deleteCanvas: deleteCanvas,
    resizeCanvas: resizeCanvas,
    setGLesmosShader: setGLesmosShader,
    render: render,
  };
}
