import template from "@babel/template";
import * as t from "@babel/types";
import { findIdentifierThis } from "preload/overrideHelpers/moduleUtils";
import { DependencyNameMap } from "preload/overrideHelpers/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  ReturnStatement(path: babel.NodePath<t.ReturnStatement>) {
    /* @plugin better-evaluation-view

    @what Currently shows all lists in the evaluator 
    
    @how
      Replaces
        if (cond) { e.createSlidersForItem(...) }
      with
        if (cond && !window.Desmodder.controller.isErrorHidden(l.id)) { e.createSlidersForItem(...) }
    */
    const returned = path.node.argument;
    if (
      returned &&
      t.isCallExpression(returned) &&
      t.isMemberExpression(returned.callee) &&
      t.isIdentifier(returned.callee.property, {
        name: "getEvaluationType",
      })
    ) {
      const switchObject = path.getFunctionParent()?.getAllNextSiblings()[0];

      if (switchObject?.node && t.isObjectExpression(switchObject?.node)) {
        const listProperty = switchObject.node.properties.find((p) => {
          return (
            t.isObjectProperty(p) &&
            t.isIdentifier(p.key) &&
            p.key.name === "list"
          );
        });

        if (
          !(
            t.isObjectProperty(listProperty) &&
            t.isFunctionExpression(listProperty.value) &&
            t.isBlockStatement(listProperty.value.body) &&
            t.isReturnStatement(listProperty.value.body.body[0])
          )
        )
          return;

        listProperty.value.body.body[0].argument =
          template.expression(String.raw`
            %%DCGView%%.Components.IfElse(
              () => window.DesModder?.controller?.isPluginEnabled("better-evaluation-view"),
              {
                false: () => {console.log(%%oldElement%%);return %%oldElement%%},
                true: () => {console.log("test");return %%DCGView%%.createElement(%%StaticMathquillView%%.default, {
                  latex: function () {
                    let val = %%this%%.props.val()
                    console.log(val)
                    return "\\left[" + (val.length <= 10 ? val.join(",") : val.slice(0,10) + ",...") + "\\right]";
                  },
                  config: %%this%%.const({}),
                })}
              }
            )
        `)({
            oldElement: listProperty.value.body.body[0].argument,
            DCGView: dependencyNameMap.dcgview,
            StaticMathquillView:
              dependencyNameMap["dcgview-helpers/static-mathquill-view"],
            this: findIdentifierThis(switchObject),
          });
      }
    }
  },
});
