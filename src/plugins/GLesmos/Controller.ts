import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import exportAsGLesmos from "./exportAsGLesmos";
import ViewportTransforms from "./ViewportTransforms";

export default class Controller {
  canvas: GLesmosCanvas | null = null;

  initCanvas() {
    this.canvas = initGLesmosCanvas();
  }

  reapplyShader() {
    this.canvas?.setGLesmosShader(exportAsGLesmos());
    this.canvas?.render();
  }

  deleteCanvas() {
    this.canvas?.deleteCanvas();
    this.canvas = null;
  }

  drawGlesmosSketchToCtx(
    id: string,
    ctx: CanvasRenderingContext2D,
    transforms: ViewportTransforms
  ) {
    if (this.canvas?.element) {
      this.canvas.updateTransforms(transforms);
      this.reapplyShader();
      ctx.drawImage(this.canvas?.element, 0, 0);
    }
  }
}
