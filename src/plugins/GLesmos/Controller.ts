import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import ViewportTransforms from "./ViewportTransforms";

export default class Controller {
  canvas: GLesmosCanvas | null = null;

  constructor() {
    this.canvas = initGLesmosCanvas();
  }

  deleteCanvas() {
    this.canvas?.deleteCanvas();
    this.canvas = null;
  }

  drawGlesmosSketchToCtx(
    compiledGL: CompiledGL,
    ctx: CanvasRenderingContext2D,
    transforms: ViewportTransforms
  ) {
    const compiledGLString = [
      compiledGL.deps.join("\n"),
      compiledGL.defs.join("\n"),
      "",
      "vec4 outColor = vec4(0.0);",
      "void glesmosMain(vec2 coords) {",
      "  float x = coords.x; float y = coords.y;",
      compiledGL.bodies.join("\n"),
      "}",
    ].join("\n");
    console.log(compiledGLString);
    if (this.canvas?.element) {
      this.canvas.updateTransforms(transforms);
      this.canvas?.setGLesmosShader(compiledGLString);
      this.canvas?.render();
      ctx.drawImage(this.canvas?.element, 0, 0);
    }
  }
}

interface CompiledGL {
  deps: string[];
  defs: string[];
  bodies: string[];
}
