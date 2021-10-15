import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "../overrideHelpers/moduleUtils";
import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";

function actionCreate(
  tooltip: string,
  buttonClass: string,
  iconClass: string,
  onTap: string
) {
  return `() => %%DCGView%%.createElement(
    %%Tooltip%%.Tooltip,
    {
      tooltip: %%DCGView%%.const("${tooltip}"),
      gravity: %%DCGView%%.const("s")
    },
    %%DCGView%%.createElement(
      "span",
      {
        class: %%DCGView%%.const(
          "${buttonClass} dsm-stay-edit-list-mode dcg-exp-action-button"
        ),
        handleEvent: %%DCGView%%.const("true"),
        role: %%DCGView%%.const("button"),
        tabindex: %%DCGView%%.const("0"),
        onTap: ${onTap}
      },
      %%DCGView%%.createElement("i", {
        class: %%DCGView%%.const("${iconClass} dsm-stay-edit-list-mode"),
      })
    )
  )`;
}

const pinUnpinAction = `
  %%DCGView%%.createElement(
    %%DCGView%%.Components.If,
    {
      predicate: () => window.DesModder.controller.pluginsEnabled["pin-expressions"] && %%this%%.model().type !== "folder"
    },
    () => %%DCGView%%.Components.IfElse(
      () => window.DesModder?.controller?.isPinned(%%this%%.model().id),
      {
        false: ${actionCreate(
          "Pin",
          "dsm-pin-button",
          "dsm-icon-bookmark-outline-add",
          "() => window.DesModder.controller.pinExpression(%%this%%.model().id)"
        )},
        true: ${actionCreate(
          "Unpin",
          "dsm-unpin-button",
          "dsm-icon-bookmark",
          "() => window.DesModder.controller.unpinExpression(%%this%%.model().id)"
        )}
      }
    )
  )`;

const folderDumpAction = `
  %%DCGView%%.createElement(
    %%DCGView%%.Components.If,
    {
      predicate: () => window.DesModder.controller.pluginsEnabled["folder-tools"] && %%this%%.model().type === "folder"
        && window.Calc.controller.getItemModelByIndex(%%this%%.model().index + 1)?.folderId === %%this%%.model().id
    },
    ${actionCreate(
      "Dump",
      "dsm-folder-dump-button",
      "dsm-icon-folder-minus",
      "() => window.DesModder.controller.folderDump(%%this%%.model().index)"
    )}
  )
  `;

const folderMergeAction = `
  %%DCGView%%.createElement(
    %%DCGView%%.Components.If,
    {
      predicate: () => window.DesModder.controller.pluginsEnabled["folder-tools"] && %%this%%.model().type === "folder"
    },
    ${actionCreate(
      "Merge",
      "dsm-folder-merge-button",
      "dsm-icon-folder-plus",
      "() => window.DesModder.controller.folderMerge(%%this%%.model().index)"
    )}
  )
  `;

const noteEncloseAction = `
  %%DCGView%%.createElement(
    %%DCGView%%.Components.If,
    {
      predicate: () => window.DesModder.controller.pluginsEnabled["folder-tools"] && %%this%%.model().type === "text"
    },
    ${actionCreate(
      "Enclose",
      "dsm-note-enclose-button",
      "dsm-icon-folder-plus",
      "() => window.DesModder.controller.noteEnclose(%%this%%.model().index)"
    )}
  )
  `;

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value == "dcg-expression-edit-actions") {
      /* @plugin pin-expressions
      @plugin folder-tools
      
      @what Add pin/unpin buttons, and add folder-merge and folder-dump buttons
      
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
        ...[
          pinUnpinAction,
          noteEncloseAction,
          folderDumpAction,
          folderMergeAction,
        ].map((action) =>
          template.expression(action)({
            DCGView: dependencyNameMap.dcgview,
            Tooltip: dependencyNameMap["../shared-components/tooltip"],
            this: findIdentifierThis(path),
          })
        )
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
