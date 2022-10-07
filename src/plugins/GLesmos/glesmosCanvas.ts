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

type UniformType = "1f" | "2fv" | "3fv" | "4fv" | "1i" | "Matrix2fv";

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
    ...[
      gl.getUniformLocation(program, uniformName),
      ...(uniformType.startsWith("Matrix") ? [false] : []),
      uniformValue,
    ]
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

const BLIT_FRAGMENT_SHADER = `#version 300 es

precision highp float;

in vec2 texCoord;
out vec4 fragColor;

uniform sampler2D tex;

void main() {
    fragColor = texture(tex, texCoord);
}`;

const MIX_FRAGMENT_SHADER = `#version 300 es

precision highp float;

in vec2 texCoord;
out vec4 fragColor;

uniform sampler2D tex1;
uniform sampler2D tex2;
uniform float factor;
uniform vec2 scaleFactor;
uniform vec2 translation;
uniform int renderindex;
uniform int speed;

void main() {
    vec2 transformedTexCoord = scaleFactor * (texCoord + translation);
    vec2 size = floor(vec2(textureSize(tex1, 0)) / float(speed)) * float(speed);
    int pixeltype = (int(texCoord.x * size.x) % speed)
      + speed * (int(texCoord.y * size.y) % speed);
    fragColor = mix(
      texture(tex1, transformedTexCoord),
      texture(tex2, texCoord),
      all(equal(clamp(transformedTexCoord, 0.0, 1.0), transformedTexCoord))
      ?
      ((pixeltype == renderindex) ? 1.0 : 0.0)
      : 1.0
    );
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
  let gl: WebGL2RenderingContext = c.getContext("webgl2", {
    // Disable premultiplied alpha
    // Thanks to <https://stackoverflow.com/a/12290551/7481517>
    premultipliedAlpha: false,
  }) as WebGL2RenderingContext;

  let prevFramebuffer: WebGLFramebuffer | null;
  let prevTexture: WebGLTexture | null;

  let currFramebuffer: WebGLFramebuffer | null;
  let currTexture: WebGLTexture | null;

  let currFramebuffer2: WebGLFramebuffer | null;
  let currTexture2: WebGLTexture | null;

  let vao: WebGLVertexArrayObject | null;

  //================= GRAPH BOUNDS ======================
  let cornerOfGraph = [-10, -6];
  let sizeOfGraph = [20, 12];

  //======================= RESIZING STUFF =======================

  let currentWidth = 0;
  let currentHeight = 0;

  let forceUpdateTransforms = false;

  let updateTransforms = (transforms: ViewportTransforms) => {
    //console.log("Updated GLesmos transforms.");
    const w = transforms.pixelCoordinates.right;
    const h = transforms.pixelCoordinates.bottom;
    const p2m = transforms.pixelsToMath;
    cornerOfGraph = [p2m.tx, p2m.sy * h + p2m.ty];
    sizeOfGraph = [p2m.sx * w, -p2m.sy * h];

    const [fw, fh] = [Math.floor(w), Math.floor(h)];

    if (currentWidth == fw && currentHeight == fh && !forceUpdateTransforms)
      return;
    forceUpdateTransforms = false;
    console.log(fw, fh);
    currentWidth = fw;
    currentHeight = fh;

    c.width = fw;
    c.height = fh;

    currFramebuffer2 = gl.createFramebuffer();
    currTexture2 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, currTexture2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      Math.floor(w / speed),
      Math.floor(h / speed),
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, currFramebuffer2);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      currTexture2,
      0
    );

    prevFramebuffer = gl.createFramebuffer();
    prevTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, prevTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      currentWidth,
      currentHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      prevTexture,
      0
    );

    currFramebuffer = gl.createFramebuffer();
    currTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, currTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      currentWidth,
      currentHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, currFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      currTexture,
      0
    );
  };

  //============================ WEBGL STUFF ==========================
  let fullscreenQuadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

  let glesmosShaderProgram: WebGLProgram | undefined;
  let blitShaderProgram: WebGLProgram | undefined;
  let mixShaderProgram: WebGLProgram | undefined;

  let oldShaderCode = "";

  let setGLesmosShader = (shaderCode: string, id: string) => {
    if (shaderCode == oldShaderCode) return;
    widthSinceLastRender = 0;
    heightSinceLastRender = 0;
    oldShaderCode = shaderCode;
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
    blitShaderProgram = buildShaderProgram(
      gl,
      VERTEX_SHADER,
      BLIT_FRAGMENT_SHADER,
      id
    );
    mixShaderProgram = buildShaderProgram(
      gl,
      VERTEX_SHADER,
      MIX_FRAGMENT_SHADER,
      id
    );
    if (!glesmosShaderProgram) return;
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let vertexPositionAttribLocation = gl.getAttribLocation(
      glesmosShaderProgram,
      "vertexPosition"
    );
    gl.enableVertexAttribArray(vertexPositionAttribLocation);
    gl.vertexAttribPointer(
      vertexPositionAttribLocation,
      2,
      gl.FLOAT,
      false,
      8,
      0
    );
  };

  let xSinceLastRender = 0;
  let ySinceLastRender = 0;

  let widthSinceLastRender = 0;
  let heightSinceLastRender = 0;
  let drawindex = 0;
  let speed = 2;
  let setSpeed = (n: number) => {
    speed = n;
    forceUpdateTransforms = true;
  };

  let render = (id: string) => {
    if (glesmosShaderProgram && blitShaderProgram && mixShaderProgram) {
      let jitterX = drawindex % speed;
      let jitterY = Math.floor(drawindex / speed);
      //gl.enable(gl.SCISSOR_TEST);
      //gl.scissor((drawindex % 4) / 4 * currentWidth, Math.floor(drawindex / 4) / 4 * currentHeight, 0.25 * currentWidth, 0.25 * currentHeight)
      gl.bindVertexArray(vao);

      // render main image
      if (speed == 1) {
        gl.viewport(0, 0, c.width, c.height);
      } else {
        gl.viewport(
          0,
          0,
          Math.floor(currentWidth / speed),
          Math.floor(currentHeight / speed)
        );
      }
      gl.bindFramebuffer(
        gl.DRAW_FRAMEBUFFER,
        speed == 1 ? null : currFramebuffer2
      );

      gl.useProgram(glesmosShaderProgram);

      setUniform(gl, glesmosShaderProgram, "corner", "2fv", [
        cornerOfGraph[0] + (jitterX / currentWidth) * sizeOfGraph[0],
        cornerOfGraph[1] + (jitterY / currentHeight) * sizeOfGraph[1],
      ]);
      setUniform(gl, glesmosShaderProgram, "size", "2fv", sizeOfGraph);
      setUniform(gl, glesmosShaderProgram, "NaN", "1f", NaN);
      setUniform(gl, glesmosShaderProgram, "Infinity", "1f", Infinity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (speed == 1) return;

      gl.viewport(0, 0, c.width, c.height);
      // blend main image with previous image for temporal antialiasing
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, currFramebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prevTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, currTexture2);
      gl.useProgram(mixShaderProgram);
      setUniform(gl, mixShaderProgram, "tex1", "1i", 0);
      setUniform(gl, mixShaderProgram, "tex2", "1i", 1);
      setUniform(gl, mixShaderProgram, "factor", "1f", 0.1);
      setUniform(gl, mixShaderProgram, "scaleFactor", "2fv", [
        sizeOfGraph[0] / widthSinceLastRender,
        sizeOfGraph[1] / heightSinceLastRender,
      ]);
      setUniform(gl, mixShaderProgram, "translation", "2fv", [
        (cornerOfGraph[0] - xSinceLastRender) / sizeOfGraph[0] +
          (0.4 * (Math.random() - 0.5)) / currentWidth,
        (cornerOfGraph[1] - ySinceLastRender) / sizeOfGraph[1] +
          (0.4 * (Math.random() - 0.5)) / currentHeight,
      ]);
      setUniform(gl, mixShaderProgram, "renderindex", "1i", drawindex);
      setUniform(gl, mixShaderProgram, "speed", "1i", speed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // move current to previous image
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, prevFramebuffer);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currTexture);
      gl.useProgram(blitShaderProgram);
      setUniform(gl, blitShaderProgram, "tex", "1i", 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // actually draw to the screen
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, currTexture);
      gl.useProgram(blitShaderProgram);
      setUniform(gl, blitShaderProgram, "tex", "1i", 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      xSinceLastRender = cornerOfGraph[0];
      ySinceLastRender = cornerOfGraph[1];
      widthSinceLastRender = sizeOfGraph[0];
      heightSinceLastRender = sizeOfGraph[1];

      drawindex = (drawindex + 1) % (speed * speed);
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
    setSpeed,
    getSpeed: () => speed,
    render: render,
  };
}
