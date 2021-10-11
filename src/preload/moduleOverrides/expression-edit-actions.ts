import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "preload/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "preload/moduleUtils";
import withinFunctionAssignment from "preload/withinFunctionAssignment";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value == "dcg-expression-edit-actions") {
      /* Add pin/unpin buttons */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      /*
        We want to insert after "duplicate expression" and before "delete expression"
        <span class="dcg-expression-edit-actions">
          <If predicate> dcg-graphic idk </If>
          <If predicate> convert to table </If>
          <If predicate> duplicate expression </If>
          <If predicate> delete expression </If>
        </span>
        */
      createElementCall.node.arguments.splice(
        5, // (1 for the "span") + (1 for the HTML attributes) + (3 for the three <If>s it comes after)
        0,
        template.expression(
          `
          %%DCGView%%.createElement(
            %%DCGView%%.Components.If,
            {
              predicate: () => window.DesModder.controller.pluginsEnabled["pin-expressions"] && %%this%%.model().type !== "folder"
            },
            () => %%DCGView%%.Components.IfElse(
              () => window.DesModder?.controller?.isPinned(%%this%%.model().id),
              {
                false: () => %%DCGView%%.createElement(
                  %%Tooltip%%.Tooltip,
                  {
                    tooltip: %%DCGView%%.const("Pin"),
                    gravity: %%DCGView%%.const("s")
                  },
                  %%DCGView%%.createElement(
                    "span",
                    {
                      class: %%DCGView%%.const(
                        "dsm-pin-button dsm-stay-edit-list-mode dcg-exp-action-button"
                      ),
                      handleEvent: %%DCGView%%.const("true"),
                      role: %%DCGView%%.const("button"),
                      tabindex: %%DCGView%%.const("0"),
                      onTap: () => window.DesModder.controller.pinExpression(%%this%%.model().id)
                    },
                    %%DCGView%%.createElement("i", {
                      class: %%DCGView%%.const("dsm-icon-bookmark-outline-add dsm-stay-edit-list-mode"),
                    })
                  )
                ),
                true: () => %%DCGView%%.createElement(
                  %%Tooltip%%.Tooltip,
                  {
                    tooltip: %%DCGView%%.const("Unpin"),
                    gravity: %%DCGView%%.const("s")
                  },
                  %%DCGView%%.createElement(
                    "span",
                    {
                      class: %%DCGView%%.const(
                        "dsm-unpin-button dcg-exp-action-button dsm-stay-edit-list-mode"
                      ),
                      handleEvent: %%DCGView%%.const("true"),
                      role: %%DCGView%%.const("button"),
                      tabindex: %%DCGView%%.const("0"),
                      onTap: () => window.DesModder.controller.unpinExpression(%%this%%.model().id)
                    },
                    %%DCGView%%.createElement("i", {
                      class: %%DCGView%%.const("dsm-icon-bookmark dsm-stay-edit-list-mode"),
                    })
                  )
                )
              }
            )
          )
          `
        )({
          DCGView: dependencyNameMap.dcgview,
          Tooltip: dependencyNameMap["../shared-components/tooltip"],
          this: findIdentifierThis(path),
        })
      );
    }

    /* Following belongs in duplicate-hotkey, but can't duplicate module overrides in the current system */
    /* Prevent exiting edit-list-mode, to allow duplicating non-expressions */
    const classes = path.node.value.split(" ");
    if (
      classes.includes("dcg-duplicate-btn") ||
      // Also prevent exiting ELM for the delete button, fixing Desmos request # 81806 early
      classes.includes("dcg-delete-btn")
    ) {
      path.node.value = path.node.value + " dsm-stay-edit-list-mode";
    }
  },
  /* Following belongs in duplicate-hotkey, but can't duplicate module overrides in the current system */
  enter(path: babel.NodePath) {
    withinFunctionAssignment("canDuplicate", (func: t.FunctionExpression) => {
      /* Include the duplicate button even for non-expressions */
      func.body.body = [template.statement.ast(`return !this.isSlider()`)];
    }).enter(path);
    withinFunctionAssignment(
      "onDuplicateWithoutFocus",
      (func: t.FunctionExpression) => {
        /* Call DesModder's duplicate if available */
        func.body.body = [
          template.statement.ast(
            `const duplicate = window.DesModder.exposedPlugins?.["duplicate-expression-hotkey"]?.duplicateExpression`
          ),
          template.statement.ast(
            `duplicate
              ? duplicate(this.props.id())
              : this.controller.dispatch({
                  type: "duplicate-expression",
                  id: this.props.id(),
                })`
          ),
        ];
      }
    ).enter(path);
  },
});
