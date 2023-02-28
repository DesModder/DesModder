import ViewportTransforms from "./ViewportTransforms";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import { glesmosError, GLesmosShaderPackage } from "./shaders";
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

    try {
      if (!this.canvas?.element) glesmosError("WebGL Context Lost!");

      this.canvas.updateTransforms(transforms); // only do this once

      if (compiledGL.hasOutlines)
        // no grouping, perf will suffer
        for (const chunk of compiledGL.chunks) {
          this.canvas?.buildGLesmosFancy(deps, chunk);
          this.canvas?.renderFancy();
          ctx.drawImage(this.canvas?.element, 0, 0);
        }
      else {
        this.canvas?.buildGLesmosFast(deps, compiledGL.chunks);
        this.canvas?.renderFast();
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
