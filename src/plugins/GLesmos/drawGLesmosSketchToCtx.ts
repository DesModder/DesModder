import ViewportTransforms from "./ViewportTransforms";
import { initGLesmosCanvas, GLesmosCanvas } from "./glesmosCanvas";
import { glesmosError, GLesmosShaderPackage } from "./shaders";
import { CalcController } from "#globals";

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
  { id, branches }: GLesmosSketch,
  glslHeader: string
) {
  branches = branches.filter((b) => b.graphMode === "GLesmos");

  const glBranches = branches.map((b) => b.compiledGL);
  if (glBranches.length === 0) return;
  const compiledGL: GLesmosShaderPackage = {
    chunks: glBranches.flatMap((b) => b.chunks),
    deps: glBranches.reduce<Record<string, boolean>>(
      (a, b) => ({ ...a, ...b.deps }),
      { [glslHeader]: true }
    ),
    hasOutlines: glBranches.reduce((a, b) => a && b.hasOutlines, true),
  };

  drawOneGLesmosSketchToCtx?.(cc, drawCtx, compiledGL, id);
}

function drawOneGLesmosSketchToCtx(
  cc: CalcController,
  { ctx, projection }: DrawCtx,
  compiledGL: GLesmosShaderPackage,
  id: string
) {
  // We persist canvas to fix #492 (some context gets messed up), so we
  // re-use the old canvas on a re-enable. This is a hacky fix.
  // There should be a way to clean up the GLesmos code
  // to avoid needing this.
  canvas = canvas ?? initGLesmosCanvas(cc);

  const deps = Object.keys(compiledGL.deps).join("\n");

  try {
    if (!canvas?.element) glesmosError("WebGL Context Lost!");

    canvas.updateTransforms(projection); // only do this once

    if (compiledGL.hasOutlines)
      // no grouping, perf will suffer
      for (const chunk of compiledGL.chunks) {
        canvas?.buildGLesmosFancy(deps, chunk);
        canvas?.renderFancy();
        ctx.drawImage(canvas?.element, 0, 0);
      }
    else {
      // No grouping. DCG_SC_uniforms will normally cause a list of
      // implicits to be the same program though (with different uniforms).
      // Grouping them might save some performance on repeated blitting,
      // but the main gain from the old grouping approach was avoiding compiles.
      for (const chunk of compiledGL.chunks) {
        canvas?.buildGLesmosFast(deps, chunk);
        canvas?.renderFast();
        ctx.drawImage(canvas?.element, 0, 0);
      }
    }
  } catch (e) {
    const model = cc.getItemModel(id);
    if (model) model.error = e instanceof Error ? e.message : e;
  }
}
