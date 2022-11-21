import {
  containingCreateElementCall,
  findIdentifierThis,
} from "../overrideHelpers/moduleUtils";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import template from "@babel/template";
import * as t from "@babel/types";

function actionCreate(
  tooltip: string,
  buttonClass: string,
  iconClass: string,
  onTap: string
) {
  return `() => %%DCGView%%.createElement(
    %%Tooltip%%.Tooltip,
    {
      tooltip: %%DCGView%%.const(DesModder.controller.format("${tooltip}")),
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
      predicate: () => window.DesModder?.controller?.isPluginEnabled?.("pin-expressions") && %%this%%.model().type !== "folder"
    },
    () => %%DCGView%%.Components.IfElse(
      () => window.DesModder?.controller?.isExpressionPinned(%%this%%.model().id),
      {
        false: ${actionCreate(
          "pin-expressions-pin",
          "dsm-pin-button",
          "dsm-icon-bookmark",
          "() => window.DesModder.controller.pinExpression(%%this%%.model().id)"
        )},
        true: ${actionCreate(
          "pin-expressions-unpin",
          "dsm-unpin-button dcg-selected",
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
      predicate: () => window.DesModder?.controller?.isPluginEnabled?.("folder-tools") && %%this%%.model().type === "folder"
        && window.Calc.controller.getItemModelByIndex(%%this%%.model().index + 1)?.folderId === %%this%%.model().id
    },
    ${actionCreate(
      "folder-tools-dump",
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
      predicate: () => window.DesModder?.controller?.isPluginEnabled?.("folder-tools") && %%this%%.model().type === "folder"
    },
    ${actionCreate(
      "folder-tools-merge",
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
      predicate: () => window.DesModder?.controller?.isPluginEnabled?.("folder-tools") && %%this%%.model().type === "text"
    },
    ${actionCreate(
      "folder-tools-enclose",
      "dsm-note-enclose-button",
      "dsm-icon-folder-plus",
      "() => window.DesModder.controller.noteEnclose(%%this%%.model().index)"
    )}
  )
  `;

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value === "dcg-expression-edit-actions") {
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
          </span> */
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
  },
});
