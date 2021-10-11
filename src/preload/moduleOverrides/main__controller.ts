import * as t from "@babel/types";
import template from "@babel/template";
import withinFunctionAssignment from "preload/withinFunctionAssignment";

export default () => ({
  /* Warning: not resiliant to variable name change (`s`, `e`, `t`) */
  ...withinFunctionAssignment(
    /* Allow deleting pinned expressions;
      Since pinned expressions have isDragDrop=true, they have
      model.dcgView = undefined, which prevents the delete animation 
      from occurring */
    "_deleteItemAndAnimateOut",
    (func: t.FunctionExpression) => {
      func.body.body.push(
        template.statement.ast(
          `s || this._finishDeletingItemAfterAnimation(e, t)`
        )
      );
    }
  ),
});
