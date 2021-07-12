import * as t from "@babel/types";
import template from "@babel/template";
import withDependencyMap, {
  DependencyNameMap,
} from "preload/withDependencyMap";
import withinExport from "preload/withinExport";

const moduleOverrides = {
  "expressions/list-view": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) => ({
      StringLiteral(path: babel.NodePath<t.StringLiteral>) {
        if (path.node.value == "dcg-exppanel-container") {
          /* Insert div.dcg-exppanel.dsm-pinned-expressions to show the pinned expressions */
          const createElementCall = path.findParent((path) =>
            path.isCallExpression()
          ) as babel.NodePath<t.CallExpression>;
          let identifierThis = null;
          createElementCall.traverse({
            MemberExpression(path) {
              if (
                t.isIdentifier(path.node.property) &&
                path.node.property.name == "makeViewForModel"
              ) {
                identifierThis = path.node.object;
                path.stop();
              }
            },
          });
          /*
          We want to insert the extra child at the end to make the first .dcg-exppanel the one selected by Desmos's JS.
          The CSS will move it to the beginning
          <div class="dcg-exppanel-container">
            <If predicate> <ExpressionsHeader/> </If>
            <If predicate> <ExpressionSearchBar/> </If>
            <If predicate> <div class="dcg-exppanel"> ... </div> </If.
          </div>
          */
          createElementCall.node.arguments.splice(
            5, // (1 for the "div") + (1 for the HTML attributes) + (3 for being after the last <If>)
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
              this: identifierThis,
            })
          );
        }
      },
    })
  ),
  "graphing-calc/models/abstract-item": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) =>
      /* Disable pinned expressions from appearing in the unpinned section */
      // might break tours/base_tour or expressions hidden inside folders
      withinExport(
        "getDisplayState",
        dependencyNameMap,
        () => template.expression.ast`function (e) {
            return e.isHiddenFromUI || e.filteredBySearch || window.DesModder?.controller?.isPinned(e.id)
              ? "none"
              : e.renderShell
              ? "shell"
              : "render";
          }`
      )
  ),
  "expressions/abstract-item-view": withDependencyMap(() => ({
    CallExpression(path: babel.NodePath<t.CallExpression>) {
      /* Allows clicking on the pin/unpin button for simulations, notes, and tables */
      if (
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, {
          name: "exitEditListMode",
        })
      ) {
        path.replaceWith(
          template.expression(
            `t.target.classList?.contains("dsm-stay-edit-list-mode") || %%callExit%%`
          )({
            callExit: path.node,
          })
        );
        // don't want to recurse on the inner copy of path.node
        path.skip();
      }
    },
  })),
  "expressions/expression-edit-actions": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) => ({
      StringLiteral(path: babel.NodePath<t.StringLiteral>) {
        if (path.node.value == "dcg-expression-edit-actions") {
          /* Add pin/unpin buttons */
          const createElementCall = path.findParent((path) =>
            path.isCallExpression()
          ) as babel.NodePath<t.CallExpression>;
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
                  predicate: () => e.model().type !== "folder"
                },
                () => %%DCGView%%.Components.IfElse(
                  () => window.DesModder?.controller?.isPinned(e.model().id),
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
                          onTap: () => window.DesModder.controller.pinExpression(e.model().id)
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
                          onTap: () => window.DesModder.controller.unpinExpression(e.model().id)
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
            })
          );
        }
      },
    })
  ),
};
export default moduleOverrides;
