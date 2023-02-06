import ViewportTransforms from "./ViewportTransforms";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import { GLesmosShaderPackage } from "./shaders";
import { Calc } from "globals/window";

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
    compiledGL: GLesmosShaderPackage, // comes from exportAsGLesmos
    ctx: CanvasRenderingContext2D,
    transforms: ViewportTransforms,
    id: string
  ) {
    const deps = compiledGL.deps.join("\n");
    for (const chunk of compiledGL.chunks) {
      // outlines will give us problems if we group these
      try {
        if (this.canvas?.element) {
          this.canvas.updateTransforms(transforms);
          this.canvas?.buildGLesmosShaders(id, deps, chunk);
          this.canvas?.render();
          ctx.drawImage(this.canvas?.element, 0, 0);
        }
      } catch (e) {
        const model = Calc.controller.getItemModel(id);
        if (model) {
          model.error = e instanceof Error ? e.message : e;
        }
      }
    }
  }
}
