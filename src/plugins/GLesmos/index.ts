import exportAsGLesmos from "./exportAsGLesmos";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";

let canvas: GLesmosCanvas;

export default {
  id: "GLesmos",
  name: "GLesmos",
  description: "Export as a GLSL fragment shader",
  onEnable: () => {
    (window as any).exportAsGLesmos = exportAsGLesmos;
    canvas = initGLesmosCanvas();
    (window as any).glesmosCanvas = canvas;
  },
  onDisable: () => {
    delete (window as any).exportAsGLesmos;
    canvas.deleteCanvas();
  },
  enabledByDefault: true,
} as const;
