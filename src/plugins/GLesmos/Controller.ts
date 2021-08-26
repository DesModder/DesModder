import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import exportAsGLesmos from "./exportAsGLesmos";

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
}
