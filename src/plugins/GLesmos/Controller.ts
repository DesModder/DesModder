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
    compiledGL: string,
    ctx: CanvasRenderingContext2D,
    transforms: ViewportTransforms
  ) {
    if (this.canvas?.element) {
      this.canvas.updateTransforms(transforms);
      this.canvas?.setGLesmosShader(compiledGL);
      this.canvas?.render();
      ctx.drawImage(this.canvas?.element, 0, 0);
    }
  }
}
