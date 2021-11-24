import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import { containingCreateElementCall } from "../overrideHelpers/moduleUtils";
import { findIdentifierThis } from "../overrideHelpers/moduleUtils";
import "./styles/promptslider_view.less";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    /* @plugin hide-errors
    
    @what Add a "hide" button to the slider options
    
    @how
      Adds a new <If></If> to the create-sliders container, detected
      through the string "btns"
    */
    if (path.node.value === "btns") {
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.node.arguments.push(
        template.expression(`
        %%DCGView%%.createElement(
          %%DCGView%%.Components.If,
          {
            predicate: () => (
              %%this%%.model.type !== "ticker" &&
              DesModder.controller?.isPluginEnabled("hide-errors")
            ),
          },
          () => %%DCGView%%.createElement(
            "div",
            {
              class: %%DCGView%%.const("dcg-slider-btn-container dsm-hide-errors")
            },
            %%DCGView%%.createElement(
              "div",
              {
                role: %%DCGView%%.const("button"),
                tabindex: %%DCGView%%.const("0"),
                class: %%DCGView%%.const("dcg-btn-slider dcg-btn-light-gray")
              },
              () => "hide"
            )
          )
        )
      `)({
          DCGView: dependencyNameMap.dcgview,
          this: findIdentifierThis(path),
        })
      );
    }
    /* @plugin hide-errors
    
    @what Trigger DesModder hide instead of create-sliders-for-item on tap
    
    @how
      Before `var r = e.hasClass("dcg-all")`, check for `e.hasClass("dsm-hide-errors")`.
      If true, then hide the error and early return.
    */
    if (path.node.value === "dcg-all") {
      const parentNode = path.parentPath.node;
      if (t.isCallExpression(parentNode)) {
        const block = path.findParent((p) => p.isBlockStatement());
        if (block && block.isBlockStatement()) {
          block.node.body.unshift(
            template.statement(`
              if (%%hasClassCallee%%("dsm-hide-errors")) {
                DesModder.controller?.hideError(this.model.id)
                return;
              }
            `)({
              hasClassCallee: parentNode.callee,
            })
          );
        }
      }
    }
  },
  NumericLiteral(path: babel.NodePath<t.NumericLiteral>) {
    /* @plugin hide-errors
    
    @what Reduce suggested slider count to 3.
    
    @how
      Replaces the literal 4 with 3 (conditionally) in `t.getMissingVariables().slice(0, 4)`

    @why
      Avoids overflowing on narrow expression lists.
    */
    if (path.node.value === 4) {
      path.replaceWith(
        template.expression.ast(
          `DesModder.controller?.isPluginEnabled("hide-errors") ? 3 : 4`
        )
      );
      path.skip();
    }
  },
});
