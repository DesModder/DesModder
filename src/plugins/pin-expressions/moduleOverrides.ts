import * as t from "@babel/types";
import template from "@babel/template";
import withDependencyMap, {
  DependencyNameMap,
} from "preload/withDependencyMap";
import withinFunctionAssignment from "preload/withinFunctionAssignment";
import { extendErrors } from "ajv/dist/compile/errors";

function findIdentifierThis(path: babel.NodePath) {
  // Didn't figure out path.scope, so ...
  // Hopes that something like `var e = this` is the start of a function parent of `path`
  // Returns the identifier `e`
  let func = path.getFunctionParent();
  while (func !== null) {
    let body = func.node.body;
    if (t.isBlockStatement(body)) {
      for (let statement of body.body) {
        if (t.isVariableDeclaration(statement)) {
          for (let decl of statement.declarations) {
            if (t.isThisExpression(decl.init) && t.isIdentifier(decl.id)) {
              return decl.id;
            }
          }
        }
      }
    }
    func = func.getFunctionParent();
  }
  return null;
}

function containingCreateElementCall(path: babel.NodePath) {
  return path.findParent(
    (path) =>
      path.isCallExpression() &&
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "createElement" })
  ) as babel.NodePath<t.CallExpression>;
}

const replaceTopLevelDelete = withDependencyMap((dependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    const classes = path.node.value.split(" ");
    if (classes.includes("dcg-top-level-delete")) {
      const createElementCall = containingCreateElementCall(path);
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
}));

const moduleOverrides = {
  "expressions/list-view": withDependencyMap(
    (dependencyNameMap: DependencyNameMap) => ({
      StringLiteral(path: babel.NodePath<t.StringLiteral>) {
        if (path.node.value == "dcg-exppanel-container") {
          /* Insert div.dcg-exppanel.dsm-pinned-expressions to show the pinned expressions */
          const createElementCall = containingCreateElementCall(path);
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
              this: findIdentifierThis(path),
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
      withinFunctionAssignment(
        "getDisplayState",
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
      /* Allows clicking on the pin/unpin button for notes and tables */
      if (
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, {
          name: "exitEditListMode",
        })
      ) {
        path.replaceWith(
          // using .closest handles the case where the user clicks directly on the (child/::before) icon instead of the padding
          template.expression(
            `%%t%%.target.closest(".dsm-stay-edit-list-mode") || %%callExit%%`
          )({
            callExit: path.node,
            t: path.getFunctionParent()?.node.params[0],
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
          const createElementCall = containingCreateElementCall(path);
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
        withinFunctionAssignment(
          "canDuplicate",
          (func: t.FunctionExpression) => {
            /* Include the duplicate button even for non-expressions */
            func.body.body = [
              template.statement.ast(`return !this.isSlider()`),
            ];
          }
        ).enter(path);
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
    })
  ),
  "graphing-calc/models/list": withDependencyMap(() => ({
    FunctionDeclaration(path: babel.NodePath<t.FunctionDeclaration>) {
      /* Warning: not resiliant to variable name change (`y`, `g`, `v`, `r`, `e`, `t`) */
      if (
        t.isIdentifier(path.node.id) &&
        ["y", "g"].includes(path.node.id.name)
      ) {
        /* Prevent arrow keys from moving between pinned and unpinned expressions */
        /* y = findPrevSelectableItem and g = findNextSelectableItem, we replace r && !isItemSelectable(r)
        with r && !isItemSelectable(r) && (same pinned status as starting item) */
        path.node.body.body.unshift(
          template.statement.ast(
            `var isPinned = window.DesModder?.controller?.isPinned(_(e, t).id)`
          )
        );
        path.traverse({
          UnaryExpression(path1: babel.NodePath<t.UnaryExpression>) {
            if (
              path1.node.operator === "!" &&
              t.isCallExpression(path1.node.argument) &&
              t.isIdentifier(path1.node.argument.callee, { name: "v" })
            ) {
              path1.replaceWith(
                template.expression.ast(
                  `!v(r) || isPinned !== window.DesModder?.controller?.isPinned(r.id)`
                )
              );
              path1.stop();
            }
          },
        });
      }
    },
  })),
  "graphing-calc/actions/keyboard": withDependencyMap(() => ({
    CallExpression(path: babel.NodePath<t.CallExpression>) {
      if (
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property, { name: "selectNextItem" })
      ) {
        /* Prevent the down arrow from creating a new last item when pressing down from the bottom-most pinned expression */
        /* Change `!List.selectNextItem(e.getListModel())`
        to !(window.DesModder?.controller?.isPinned(e.getSelectedItem().id) + List.selectNextItem(e.getListModel())) */
        path.replaceWith(
          template.expression(
            `window.DesModder?.controller?.isPinned(%%e%%.getSelectedItem().id) + %%callSelectNextItem%%`
          )({
            callSelectNextItem: path.node,
            e: path.getFunctionParent()?.node.params[0],
          })
        );
        path.skip();
      }
    },
  })),
  "main/controller": withDependencyMap(() => ({
    /* Warning: not resiliant to variable name change (`s`, `e`, `t`) */
    ...withinFunctionAssignment(
      /* Allow deleting pinned expressions;
      Since pinned expressions have isDragDrop=true, they have
      model.dcgView = undefined, which prevents the delete animation 
      from occurring */
      "_deleteItemAndAnimateOut",
      (func: t.FunctionExpression) => {
        func.body.body.push(
          template.statement.ast(
            `s || this._finishDeletingItemAfterAnimation(e, t)`
          )
        );
      }
    ),
  })),
  /* Change the top level delete button to the unpin button for pinned expressions */
  // Yes, some of these are underscores, and some are hyphens. What are you going to do about it?
  "expressions/expression_view": replaceTopLevelDelete,
  "expressions/image-view": replaceTopLevelDelete,
  "expressions/table-view": replaceTopLevelDelete,
  "expressions/text_view": replaceTopLevelDelete,

  "main/instancehotkeys": withDependencyMap(() => ({
    Identifier(path: babel.NodePath<t.Identifier>) {
      /* Allow find-replace to appear, even if the expression list is not focused */
      if (path.node.name === "isExpressionListFocused") {
        const andPath = path.findParent((p) =>
          p.isLogicalExpression()
        ) as babel.NodePath<t.LogicalExpression> | null;
        andPath?.replaceWith(andPath.node.right);
      }
    },
  })),
};
export default moduleOverrides;
