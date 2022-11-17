import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";
import template from "@babel/template";
import * as t from "@babel/types";

export default () =>
  withinFunctionAssignment("addStatement", (func: t.FunctionExpression) => {
    /* @plugin glesmos

    @what Pass glesmos flag to worker
    */
    func.body.body.unshift(
      template.statement(`
        if (%%statement%%.type === "statement") {
          %%statement%%.glesmos = window.DesModder?.controller?.isGlesmosMode?.(%%statement%%.id);
        }
      `)({
        statement: func.params[0],
      })
    );
  });
