import { PluginController } from "../PluginController";
import "glesmos.less";
import { Calc } from "globals/window";

export default class GLesmos extends PluginController {
  static id = "GLesmos" as const;
  static enabledByDefault = false;

  afterEnable() {
    this.checkGLesmos();
  }

  afterDisable() {
    this.checkGLesmos();
    // Don't delete the canvas
  }

  checkGLesmos() {
    const glesmosIDs = this.controller.metadata
      ?.getDsmItemModels()
      .filter((v) => v.glesmos)
      .map((v) => v.id);
    if (glesmosIDs && glesmosIDs.length > 0) {
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
    this.controller.metadata?.checkForMetadataChange();
    return this.controller.metadata?.getDsmItemModel(id)?.glesmos ?? false;
  }

  toggleGlesmos(id: string) {
    this.controller.metadata?.updateExprMetadata(id, {
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
    this.controller.metadata?.checkForMetadataChange();
    return (
      this.controller.metadata?.getDsmItemModel(id)?.glesmosLinesConfirmed ??
      false
    );
  }

  toggleGLesmosLinesConfirmed(id: string) {
    this.controller.metadata?.updateExprMetadata(id, {
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
