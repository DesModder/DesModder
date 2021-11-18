import { Calc } from "globals/window";
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
    transforms: ViewportTransforms,
    id: string
  ) {
    const compiledGLString = [
      compiledGL.deps.join("\n"),
      compiledGL.defs.join("\n"),
      // Non-premultiplied alpha:
      `vec4 mixColor(vec4 from, vec4 top) {
        float a = 1.0 - (1.0 - from.a) * (1.0 - top.a);
        return vec4((from.rgb * from.a * (1.0 - top.a) + top.rgb * top.a) / a, a);
      }`,
      "vec4 outColor = vec4(0.0);",
      "void glesmosMain(vec2 coords) {",
      "  float x = coords.x; float y = coords.y;",
      compiledGL.bodies.join("\n"),
      "}",
    ].join("\n");
    try {
      if (this.canvas?.element) {
        this.canvas.updateTransforms(transforms);
        this.canvas?.setGLesmosShader(compiledGLString, id);
        this.canvas?.render(id);
        ctx.drawImage(this.canvas?.element, 0, 0);
      }
    } catch (e) {
      const model = Calc.controller.getItemModel(id);
      if (model) {
        model.error = e;
      }
    }
  }
}

interface CompiledGL {
  deps: string[];
  defs: string[];
  bodies: string[];
}
