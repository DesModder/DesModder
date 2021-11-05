import * as t from "@babel/types";
import template from "@babel/template";
import withinFunctionAssignment from "preload/overrideHelpers/withinFunctionAssignment";

/* @plugin glesmos

    @what Replace main renderer with glesmos rendering when necessary

    @how
      Insert
        for (let branch of e.branches) {
          if (branch.graphMode === "GLesmos") {
            // t: CanvasRenderingContext2D
            window.DesModder?.controller?.exposedPlugins[
              "GLesmos"
            ]?.drawGlesmosSketchToCtx?.(t, branch.compiledGL);
          }
        }
      at the start of the consequent of the if statement in:
        A.drawSketchToCtx = function (e, t, i, o, l, a) {
          var c;
          if ((a || (a = {}), e.branches && e.branches.length)) {
            // (here)
            var s = t.lineWidth,
            // ...
          }
        }

    An alternative is to do the following, but it's harder to implement.
    The advantage would be iterating at the same time as other branches, which
    is only necessary if graphMode:"GLesmos" branches were mixed with graphMode:IMPLICIT.
      Insert
        if (O.graphMode === "GLesmos") {
          window.DesModder?.controller?.exposedPlugins[
            "GLesmos"
          ]?.drawGlesmosSketchToCtx?.(t, O.compiledGL);
          continue;
        }
      after the first statement in 
        for (var P = 0; P < e.branches.length; P++) {
          var O = e.branches[P];
          // (here)
          ...
        }
    */
export default () =>
  withinFunctionAssignment("drawSketchToCtx", (func: t.FunctionExpression) => {
    const ifStatement = func.body.body[1];
    if (
      t.isIfStatement(ifStatement) &&
      t.isBlockStatement(ifStatement.consequent)
    ) {
      ifStatement.consequent.body.unshift(
        template.statement(`
          for (let branch of %%e%%.branches) {
            if (branch.graphMode === "GLesmos") {
              window.DesModder?.controller?.exposedPlugins[
                "GLesmos"
              ]?.drawGlesmosSketchToCtx?.(branch.compiledGL, %%ctx%%, %%transforms%%);
            }
          }
        `)({
          e: func.params[0],
          ctx: func.params[1],
          transforms: func.params[2],
        })
      );
    }
  });
