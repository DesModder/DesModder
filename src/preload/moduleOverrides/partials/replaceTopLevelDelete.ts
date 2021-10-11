import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "preload/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "preload/moduleUtils";

export default (dependencyNameMap: DependencyNameMap) => ({
  /* @plugin pin-expressions

  @what Replace the delete button with unpin button when an expression is pinned.
    This gets applied to expression_view, image-view, table-view, and text_view

  @how
    Replaces
        createElement("i", { class: "dcg-icon-remove dcg-top-level-delete", ... })
    with
        DCGView.Components.IfElse(
          isPinned,
          {
            false: createElement("i", { class: "dcg-icon-remove dcg-top-level-delete", ... }),
            true: createElement("i", { class: "dcg-icon-bookmark dcg-top-level-delete", onTap... })
          }
        )
  */
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    const classes = path.node.value.split(" ");
    if (classes.includes("dcg-top-level-delete")) {
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.replaceWith(
        template.expression(`
          %%DCGView%%.Components.IfElse(
            () => window.DesModder?.controller?.isPinned(%%this%%.model.id),
            {
              false: () => %%cec%%,
              true: () => %%DCGView%%.createElement("i", {
                class: %%DCGView%%.const("dsm-icon-bookmark dcg-top-level-delete"),
                handleEvent: %%DCGView%%.const("true"),
                onTap: () => window.DesModder.controller.unpinExpression(%%this%%.model.id),
              })
            }
          )
        `)({
          cec: createElementCall.node,
          DCGView: dependencyNameMap.dcgview,
          this: findIdentifierThis(path),
        })
      );
      createElementCall.skip();
    }
  },
});
