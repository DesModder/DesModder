import * as t from "@babel/types";
import template from "@babel/template";
import withinFunctionAssignment from "preload/withinFunctionAssignment";

export default () => ({
  /* Warning: not resiliant to variable name change (`s`, `e`, `t`) */
  ...withinFunctionAssignment(
    /* @plugin pin-experssions
    
    @what Allow deleting pinned expressions;
    
    @why Since pinned expressions have isDragDrop=true, they have
      model.dcgView = undefined, which previously prevented the delete animation 
      from occurring 

    @how 
      Appends to the body of
        _deleteItemAndAnimateOut = function (e, t) {
          // ...
          s && (..., setTimeout(() => (
            i.dispatch({
              type: "finish-deleting-item-after-animation",
              id: e,
              setFocusAfterDelete: t,
            })
          ))
        }
      Specifically adding
        s || this._finishDeletingItemAfterAnimation(e, t)
    */
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
