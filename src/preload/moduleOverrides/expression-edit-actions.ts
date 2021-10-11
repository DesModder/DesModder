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
      /* @plugin pin-expressions
      
      @what Add pin/unpin buttons 
      
      @how
        Splices in a new <If predicate></If> after "duplicate expression" and before "delete expression" in
          <span class="dcg-expression-edit-actions">
            <If predicate> dcg-graphic idk </If>
            <If predicate> convert to table </If>
            <If predicate> duplicate expression </If>
            // here
            <If predicate> delete expression </If>
          </span>*/
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
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

    /* @plugin duplicate-hotkey

    @what Prevent exiting edit-list-mode when the duplicate button is clicked,
      to allow duplicating non-expressions

    @how Appends " dsm-stay-edit-list-mode" to the class names of the duplicate button.
      The fresh class name is used in abstract-item-view.ts.
    */
    const classes = path.node.value.split(" ");
    if (
      classes.includes("dcg-duplicate-btn") ||
      // Also prevent exiting ELM for the delete button, fixing Desmos request # 81806 early
      classes.includes("dcg-delete-btn")
    ) {
      path.node.value = path.node.value + " dsm-stay-edit-list-mode";
    }
  },
  enter(path: babel.NodePath) {
    withinFunctionAssignment("canDuplicate", (func: t.FunctionExpression) => {
      /* @plugin duplicate-hotkey
      
      @what Include the duplicate button even for non-expressions
      
      @how
        Replace
          canDuplicate = function () {
            var e = this.model();
            return e && "expression" === e.type && !this.isSlider();
          }
        with
          canDuplicate = function () {
            var e = this.model();
            return !this.isSlider();
          }
      */
      func.body.body = [template.statement.ast(`return !this.isSlider()`)];
    }).enter(path);
    withinFunctionAssignment(
      "onDuplicateWithoutFocus",
      (func: t.FunctionExpression) => {
        /* @plugin duplicate-hotkey

        @what Call DesModder's duplicate, instead of the default, if available

        @how
          Replace
            onDuplicateWithoutFocus = function () {
              this.controller.dispatch({
                type: "duplicate-expression",
                id: this.props.id(),
              });
            })
          with a variant that calls DesModder's duplicate if it loaded correctly;
            otherwise it dispatches a duplicate-expression event in the same way as before.
        */
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
