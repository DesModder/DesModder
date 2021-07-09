import * as t from "@babel/types";
import template from "@babel/template";
import withDependencyMap, {
  DependencyNameMap,
} from "preload/withDependencyMap";

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
                    // for now, just pin the first two item models
                    return %%this%%.controller.getAllItemModels().slice(0,2);
                  },
                  key: function (e) {
                    return e.guid;
                  },
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
                    return %%this%%.makeViewForModel(t)
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
    (dependencyNameMap: DependencyNameMap) => ({
      AssignmentExpression(path: babel.NodePath<t.AssignmentExpression>) {
        const lhs = path.node.left;
        /* Disable pinned expressions from appearing in the unpinned section */
        if (
          t.isMemberExpression(lhs) &&
          t.isIdentifier(lhs.object, {
            name: dependencyNameMap["exports"].name,
          }) &&
          t.isIdentifier(lhs.property, { name: "getDisplayState" }) &&
          // want to avoid replacing within the exports.exp1 = exports.exp2 = ... = void 0
          t.isFunctionExpression(path.node.right)
        ) {
          /* replace the RHS of exports.getDisplayState = __ */
          // might break tours/base_tour or expressions hidden inside folders
          path.node.right = template.expression.ast`function (e) {
            return e.isHiddenFromUI || e.filteredBySearch || e.index < 2
              ? "none"
              : e.renderShell
              ? "shell"
              : "render";
          }`;
        }
      },
    })
  ),
  "main/controller": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) => ({
      SwitchCase(path: babel.NodePath<t.SwitchCase>) {
        if (t.isStringLiteral(path.node.test, { value: "start-dragdrop" })) {
          /* Disable dragging from pinned expressions */
          path.node.consequent.unshift(
            template.statement.ast`
            if (this.getItemModel(e.id).index < 2) return;
          `
          );
        }
      },
    })
  ),
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
                  () => e.model().index < 2,
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
                            "dsm-pin-button dcg-exp-action-button"
                          ),
                          handleEvent: %%DCGView%%.const("true"),
                          role: %%DCGView%%.const("button"),
                          tabindex: %%DCGView%%.const("0"),
                          onTap: (event) => {
                            console.log("e", event)
                            window.DesModder.controller.pinExpression(e.model().id)
                          }
                        },
                        %%DCGView%%.createElement("i", {
                          class: %%DCGView%%.const("dcg-icon-open"),
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
                            "dsm-unpin-button dcg-exp-action-button"
                          ),
                          handleEvent: %%DCGView%%.const("true"),
                          role: %%DCGView%%.const("button"),
                          tabindex: %%DCGView%%.const("0"),
                          onTap: () => window.DesModder.controller.unpinExpression(e.model().id)
                        },
                        %%DCGView%%.createElement("i", {
                          class: %%DCGView%%.const("dcg-icon-point"),
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
