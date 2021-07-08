import * as t from "@babel/types";
import template from "@babel/template";
import withDependencyMap, { DependencyNameMap } from "./withDependencyMap";

import "./pinExpressions.less";

const pinExpressions = {
  "expressions/list-view": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) => ({
      StringLiteral(path: babel.NodePath<t.StringLiteral>) {
        /* Add an extra child to the DCGView.createElement class="dcg-exppanel" */
        if (path.node.value == "dcg-exppanel") {
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
              }
            },
          });
          createElementCall.node.arguments.splice(
            2,
            0,
            template.expression(
              `%%DCGView%%.createElement(
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
                    class: %%DCGView%%.const("dsm-pinned-expressions"),
                    style: () => ({
                      background: %%this%%.controller.getBackgroundColor()
                    })
                  },
                  function (t) {
                    return %%this%%.makeViewForModel(t)
                  }
                )
              )`
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
        /* replace the RHS of exports.getDisplayState = __ */
        const lhs = path.node.left;
        if (
          t.isMemberExpression(lhs) &&
          t.isIdentifier(lhs.object, {
            name: dependencyNameMap["exports"].name,
          }) &&
          t.isIdentifier(lhs.property, { name: "getDisplayState" }) &&
          // want to avoid replacing within the exports.exp1 = exports.exp2 = ... = void 0
          t.isFunctionExpression(path.node.right)
        ) {
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
};
export default pinExpressions;
