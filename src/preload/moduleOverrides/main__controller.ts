import * as t from "@babel/types";
import template from "@babel/template";
import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";

const enter1 = withinFunctionAssignment(
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
).enter;

const enter2 = withinFunctionAssignment(
  /* @plugin GLesmos
    
    @what Check/update DesModder metadata before allowing statements to update.
    
    @why Allows correct checking of the .glesmos metadata; otherwise, we run into
      Calc.observeEvent("change") triggering *after* addStatement sends the data to
      the worker. We need the correct .glesmos property before addStatement.

    @how Prepends to the body of controller.prototype.requestParseForAllItems
    */
  "requestParseForAllItems",
  (func: t.FunctionExpression) => {
    func.body.body.unshift(
      template.statement.ast(
        `window.DesModder?.controller?.checkForMetadataChange();`
      )
    );
  }
).enter;

export default () => ({
  /* Warning: not resiliant to variable name change (`s`, `e`, `t`) */
  enter(path: babel.NodePath) {
    enter1(path);
    enter2(path);
  },
});
