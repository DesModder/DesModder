import ViewportTransforms from "./ViewportTransforms";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import { glesmosError, GLesmosShaderPackage } from "./shaders";
import { CalcController, Fragile, ShaderFunctions } from "#globals";
import { EmittedGLSL } from "./exportAsGLesmos";

let canvas: GLesmosCanvas | null = null;

interface GLesmosBranch {
  graphMode: "GLesmos";
  compiledGL: GLesmosShaderPackage;
}

interface GLesmosSketch {
  id: string;
  branches: GLesmosBranch[];
}

interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  projection: ViewportTransforms;
}

/** This can't be on the GLesmos controller because it needs to be accessed
 * not just when the plugin is enabled, but also the time when the plugin
 * has just been disabled but the new sketch has not been received */
export function drawGLesmosSketchToCtx(
  cc: CalcController,
  drawCtx: DrawCtx,
  { id, branches }: GLesmosSketch
) {
  branches = branches.filter((b) => b.graphMode === "GLesmos");

  const glBranches = branches.map((b) => b.compiledGL);
  if (glBranches.length === 0) return;

  drawOneGLesmosSketchToCtx?.(cc, drawCtx, glBranches, id);
}

function drawOneGLesmosSketchToCtx(
  cc: CalcController,
  { ctx, projection }: DrawCtx,
  compiledGL: GLesmosShaderPackage[],
  id: string
) {
  // We persist canvas to fix #492 (some context gets messed up), so we
  // re-use the old canvas on a re-enable. This is a hacky fix.
  // There should be a way to clean up the GLesmos code
  // to avoid needing this.
  canvas = canvas ?? initGLesmosCanvas(cc);

  try {
    if (!canvas?.element) glesmosError("WebGL Context Lost!");

    canvas.updateTransforms(projection); // only do this once

    for (const glPackage of compiledGL) {
      const { hasOutlines, shaderFunctionsList, chunk } = glPackage;

      const joinedShaderFunctions = joinShaderFunctions(shaderFunctionsList);
      if (hasOutlines) {
        canvas?.buildGLesmosFancy(joinedShaderFunctions, chunk);
        canvas?.renderFancy();
        ctx.drawImage(canvas?.element, 0, 0);
      } else {
        canvas?.buildGLesmosFast(joinedShaderFunctions, chunk);
        canvas?.renderFast();
        ctx.drawImage(canvas?.element, 0, 0);
      }
    }
  } catch (e) {
    const model = cc.getItemModel(id);
    if (model) model.error = e instanceof Error ? e.message : e;
  }
}

function joinShaderFunctions(
  shaderFunctionsList: EmittedGLSL["shaderFunctions"][]
) {
  const dsmJoinShaderFunctions = Fragile.joinShaderFunctions;
  if (dsmJoinShaderFunctions) {
    return dsmJoinShaderFunctions(shaderFunctionsList as ShaderFunctions[]);
  } else {
    // TODO-cleanup: this branch can be removed once Desmos always provides joinShaderFunctions.
    const list = shaderFunctionsList as Record<string, boolean>[];
    const deps = Object.assign({}, ...list);
    return Object.keys(deps).join("\n");
  }
}
