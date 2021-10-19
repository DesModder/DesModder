import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "../overrideHelpers/moduleUtils";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value == "dcg-exppanel-container") {
      /* @plugin pin-expressions
      
      @what Insert div.dcg-exppanel.dsm-pinned-expressions to show the pinned expressions
      
      @how
        Splices in a new <For></For> (to show all the pinned expressions) at the end of
          <div class="dcg-exppanel-container">
            <If predicate> <ExpressionsHeader/> </If>
            <If predicate> <ExpressionSearchBar/> </If>
            <If predicate> <Ticker/> </If>
            <If predicate> <div class="dcg-exppanel"> ... </div> </If>
            // here
          </div>
          We want to insert the extra child at the end to make the first .dcg-exppanel the one selected by Desmos's JS.
          The CSS will move it to the beginning
      */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.node.arguments.splice(
        6, // (1 for the "div") + (1 for the HTML attributes) + (4 for being after the last <If>)
        0,
        template.expression(
          `
          %%DCGView%%.createElement(
            %%DCGView%%.Components.For,
            {
              each: function () {
                return %%this%%.controller.getAllItemModels();
              },
              key: function (e) {
                return e.guid;
              }
            },
            %%DCGView%%.createElement(
              "div",
              {
                class: %%DCGView%%.const("dsm-pinned-expressions dcg-exppanel"),
                style: () => ({
                  background: %%this%%.controller.getBackgroundColor()
                })
              },
              function (t) {
                return %%DCGView%%.createElement(
                  %%DCGView%%.Components.If,
                  {
                    predicate: () => window.DesModder?.controller?.isPinned(t.id)
                  },
                  // marking as a drag copy causes it not to affect the render shells calcuations
                  // (all the logic is present already because if the top expression is dragged
                  // to the bottom, it shouldn't cause all expressions to render from the top)
                  () => %%this%%.makeDragCopyViewForModel(t)
                )
              }
            )
          )
          `
        )({
          DCGView: dependencyNameMap.dcgview,
          this: findIdentifierThis(path),
        })
      );
    } else if (path.node.value === "dcg-noedit-branding") {
      /* @plugin show-tips

      @what Replace "powered by Desmos" branding with tips when tips are enabled

      @how
        Replaces
          // The original:
          DCGView.createElement(
            "span",
            { class: Dcgview.const("dcg-noedit-branding") },
            ...
          )
        with
          IfElse(
            () => DesModder.controller.isPluginEnabled("show-tips"),
            {
              false: () => // (The original) //,
              true: DesModder.view.createTipElement()
            }
          )
      */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.replaceWith(
        template.expression(`
          %%DCGView%%.Components.IfElse(
            () => window.DesModder?.controller?.isPluginEnabled?.("show-tips"),
            {
              false: () => %%oldCEC%%,
              true: () => window.DesModder?.view?.createTipElement()
            }
          )
        `)({
          DCGView: dependencyNameMap.dcgview,
          oldCEC: createElementCall.node,
        })
      );
      createElementCall.skip();
    }
  },
});
