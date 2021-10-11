import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "preload/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "preload/moduleUtils";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value == "dcg-exppanel-container") {
      /* @plugin pin-expressions
       Insert div.dcg-exppanel.dsm-pinned-expressions to show the pinned expressions */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      /*
        We want to insert the extra child at the end to make the first .dcg-exppanel the one selected by Desmos's JS.
        The CSS will move it to the beginning
        <div class="dcg-exppanel-container">
          <If predicate> <ExpressionsHeader/> </If>
          <If predicate> <ExpressionSearchBar/> </If>
          <If predicate> <Ticker/> </If>
          <If predicate> <div class="dcg-exppanel"> ... </div> </If>
        </div>
        */
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
    }
  },
});
