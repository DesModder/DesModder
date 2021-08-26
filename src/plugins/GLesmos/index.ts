import exportAsGLesmos from "./exportAsGLesmos";

export default {
  id: "GLesmos",
  name: "GLesmos",
  description: "Export as a GLSL fragment shader",
  onEnable: () => {
    (window as any).exportAsGLesmos = exportAsGLesmos;
  },
  onDisable: () => {
    delete (window as any).exportAsGLesmos;
  },
  enabledByDefault: true,
} as const;
