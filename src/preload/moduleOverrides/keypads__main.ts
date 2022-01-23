import template from "@babel/template";
import * as t from "@babel/types";
import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";

export default () =>
  /* @plugin text-mode
  
  @what Hide the keypad when in text mode

  @how Tweak the return value of 
    n.prototype.isShowKeypadButtonVisible = function () {
      return condition;
    }
  */
  //  isShowKeypadButtonVisible;
  withinFunctionAssignment(
    "isShowKeypadButtonVisible",
    (func: t.FunctionExpression) => {
      const ret = func.body.body[0];
      if (ret.type === "ReturnStatement") {
        ret.argument = template.expression(`
          %%arg%% && !window.DesModder?.controller?.inTextMode?.()
        `)({
          arg: ret.argument,
        });
      }
    }
  );
