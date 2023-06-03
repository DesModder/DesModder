import { PluginController } from "../PluginController";
import ViewportTransforms from "./ViewportTransforms";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import { glesmosError, GLesmosShaderPackage } from "./shaders";
import { Calc } from "globals/window";
import MainController from "main/Controller";

export default class GLesmos extends PluginController {
  canvas: GLesmosCanvas | null = null;

  constructor(controller: MainController) {
    super(controller);
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

  checkGLesmos() {
    const glesmosIDs = this.controller
      .getDsmItemModels()
      .filter((v) => v.glesmos)
      .map((v) => v.id);
    if (glesmosIDs.length > 0) {
      glesmosIDs.map((id) => this.toggleExpr(id));
      killWorker();
    }
  }

  canBeGLesmos(id: string) {
    let model;
    return (
      (model = Calc.controller.getItemModel(id)) &&
      model.type === "expression" &&
      model.formula &&
      model.formula.expression_type === "IMPLICIT"
    );
  }

  isGlesmosMode(id: string) {
    this.controller.checkForMetadataChange();
    return this.controller.getDsmItemModel(id)?.glesmos ?? false;
  }

  toggleGlesmos(id: string) {
    this.controller.updateExprMetadata(id, {
      glesmos: !this.isGlesmosMode(id),
    });
    this.forceWorkerUpdate(id);
  }

  forceWorkerUpdate(id: string) {
    // force the worker to revisit the expression
    this.toggleExpr(id);
    killWorker();
  }

  /** Returns boolean or undefined (representing "worker has not told me yet") */
  isInequality(id: string) {
    const model = Calc.controller.getItemModel(id);
    if (model?.type !== "expression") return false;
    return model.formula?.is_inequality;
  }

  isGLesmosLinesConfirmed(id: string) {
    this.controller.checkForMetadataChange();
    return this.controller.getDsmItemModel(id)?.glesmosLinesConfirmed ?? false;
  }

  toggleGLesmosLinesConfirmed(id: string) {
    this.controller.updateExprMetadata(id, {
      glesmosLinesConfirmed: !this.isGLesmosLinesConfirmed(id),
    });
    this.forceWorkerUpdate(id);
  }

  /**
   * Force the worker to revisit this expression by toggling it hidden then
   * un-hidden
   */
  toggleExpr(id: string) {
    const model = Calc.controller.getItemModel(id);
    if (!model || model.type !== "expression" || !model.shouldGraph) return;
    Calc.controller.dispatch({
      type: "toggle-item-hidden",
      id,
    });
    Calc.controller.dispatch({
      type: "toggle-item-hidden",
      id,
    });
  }
}

function killWorker() {
  Calc.controller.evaluator.workerPoolConnection.killWorker();
}
