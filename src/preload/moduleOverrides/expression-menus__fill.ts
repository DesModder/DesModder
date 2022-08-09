import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "../overrideHelpers/moduleUtils";
import "./styles/expression-menus__fill.less";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    /* @plugin glesmos
    
    @what Add a menu option for switching an expression to glesmos rendering mode
    
    @how
      Appends a new <If></If> to the fill menu, detected as the only title
      (class "dcg-options-menu-content") in the module.
    */
    if (path.node.value === "dcg-options-menu-content") {
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.node.arguments.push(
        template.expression(`
        %%DCGView%%.createElement(
          %%DCGView%%.Components.If,
          {
            predicate: () => DesModder.controller.canBeGLesmos(%%this%%.id),
          },
          () => %%DCGView%%.createElement(
            "div",
            { class: %%DCGView%%.const("dcg-options-menu-section-title dsm-gl-fill-title") },
            () => DesModder.controller.format("GLesmos-label-toggle-glesmos"),
            %%DCGView%%.createElement(%%ToggleView%%.ToggleView, {
              toggled: () => window.DesModder?.controller?.isGlesmosMode?.(%%this%%.id),
              onChange: (a) => window.DesModder?.controller?.toggleGlesmos?.(%%this%%.id),
            })
          )
        )
      `)({
          DCGView: dependencyNameMap.dcgview,
          ToggleView: dependencyNameMap["expressions/toggle-view"],
          this: findIdentifierThis(path),
        })
      );
    }
  },
});
