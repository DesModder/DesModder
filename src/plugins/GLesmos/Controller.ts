import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import exportAsGLesmos from "./exportAsGLesmos";
import ViewportTransforms from "./ViewportTransforms";
import computeContext, { ComputedContext } from "./computeContext";
import { satisfiesType } from "parsing/nodeTypes";

export default class Controller {
  canvas: GLesmosCanvas | null = null;
  context: ComputedContext;

  constructor() {
    this.context = computeContext();
    this.canvas = initGLesmosCanvas();
  }

  applyShader(id: string) {
    this.canvas?.setGLesmosShader(exportAsGLesmos(this.context, id));
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
    this.context = computeContext();
    if (this.canvas?.element) {
      this.canvas.updateTransforms(transforms);
      this.applyShader(id);
      ctx.drawImage(this.canvas?.element, 0, 0);
    }
  }

  canBeGlesmos(id: string) {
    const userData = this.context.statements[id].userData;
    const analysis = this.context.analysis[id];
    return (
      userData.type === "expression" &&
      userData.shouldGraph &&
      analysis.evaluationState.is_inequality &&
      analysis.evaluationState.is_graphable &&
      analysis.rawTree.type !== "Error" &&
      satisfiesType(analysis.rawTree, "BaseComparator") &&
      analysis.concreteTree.type === "IRExpression"
    );
  }
}
