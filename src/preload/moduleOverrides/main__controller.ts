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

const enter3 = withinFunctionAssignment(
  /* @plugin core
    
    @what Duplicate metadata when an expression is duplicated

    @how
      In the following statement:
        var n = this.createItemModel(
          Tslib.__assign(Tslib.__assign({}, o), { id: this.generateId() })
        );
      
      We have:
        fromId ≡ o.id
        toId ≡ n.id
      

      Append `desmodderController.duplicateMetadata(toId, fromId)`
        to the end of controller `copyExpressionToIndex`
    */
  "copyExpressionToIndex",
  (func: t.FunctionExpression, path: babel.NodePath) => {
    let fromObject: t.Identifier | null = null;
    let toObject: t.Identifier | null = null;
    path.traverse({
      CallExpression(path: babel.NodePath<t.CallExpression>) {
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.property, {
            name: "createItemModel",
          }) &&
          path.parentPath.isVariableDeclarator() &&
          t.isIdentifier(path.parentPath.node.id) &&
          t.isCallExpression(path.node.arguments[0]) &&
          t.isCallExpression(path.node.arguments[0].arguments[0]) &&
          t.isIdentifier(path.node.arguments[0].arguments[0].arguments[1])
        ) {
          toObject = path.parentPath.node.id;
          fromObject = path.node.arguments[0].arguments[0].arguments[1];
          path.stop();
        }
      },
    });
    func.body.body.push(
      template.statement(
        `window.DesModder?.controller?.duplicateMetadata(%%toObject%%.id, %%fromObject%%.id)`
      )({
        toObject,
        fromObject,
      })
    );
  }
).enter;

export default () => ({
  /* Warning: not resiliant to variable name change (`s`, `e`, `t`) */
  enter(path: babel.NodePath) {
    enter1(path);
    enter2(path);
    enter3(path);
  },
});
