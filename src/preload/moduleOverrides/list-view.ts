import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import {
  containingCreateElementCall,
  findIdentifierThis,
} from "../overrideHelpers/moduleUtils";

export default (dependencyNameMap: DependencyNameMap) => ({
  StringLiteral(path: babel.NodePath<t.StringLiteral>) {
    if (path.node.value === "dcg-exppanel-container") {
      /* @plugin pin-expressions
      @plugin text-mode
      
      @what Insert div.dcg-exppanel.dsm-pinned-expressions to show the pinned expressions
        and a div.dcg-exppanel.dsm-text-editor for the edited text
      
      @how
        Splices in a new <For></For> (to show all the pinned expressions)
        and a new <If></If> (for the text editor) at the end of
          <div class="dcg-exppanel-container">
            <If predicate> <ExpressionsHeader/> </If>
            <If predicate> <ExpressionSearchBar/> </If>
            <If predicate> <Ticker/> </If>
            <If predicate> <div class="dcg-exppanel"> ... </div> </If>
            // here
          </div>
        We want to insert the pinned expressions child at the end to make the first
        .dcg-exppanel the one selected by Desmos's JS. The CSS will move it to the beginning.
        The position of the text editor doesn't really matter. Just has to be after the header.
      */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.node.arguments.splice(
        6, // (1 for the "div") + (1 for the HTML attributes) + (4 for being after the last <If>)
        0,
        template.expression(
          `
          %%DCGView%%.createElement(
            %%DCGView%%.Components.For,
            {
              each: function () {
                return window.DesModder?.controller?.isTextMode?.()
                  ? [] 
                  : %%this%%.controller.getAllItemModels();
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
        }),
        template.expression(`
          %%DCGView%%.createElement(
            %%DCGView%%.Components.If,
            {
              predicate: () => window.DesModder?.controller?.inTextMode?.()
            },
            () => %%DCGView%%.createElement(
              "div",
              {
                class: %%DCGView%%.const("dsm-text-editor-container"),
                didMount: div => window.DesModder?.controller?.exposedPlugins["text-mode"].mountEditor(div),
                willUnmount: div => window.DesModder?.controller?.exposedPlugins["text-mode"].unmountEditor(div)
              }
            )
          )
        `)({
          DCGView: dependencyNameMap.dcgview,
        })
      );
    } else if (path.node.value === "dcg-exppanel") {
      /* @plugin text-mode

      @what Hide the main expressions list when in text mode

      @how Wrap the original create element in an IF
      */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.replaceWith(
        template.expression(
          `%%DCGView%%.createElement(
            %%DCGView%%.Components.If,
            {
              predicate: () => !window.DesModder?.controller?.inTextMode?.()
            },
            () => %%originalCEC%%
          )`
        )({
          DCGView: dependencyNameMap.dcgview,
          originalCEC: createElementCall.node,
        })
      );
      createElementCall.skip();
      path.skip();
    } else if (path.node.value === "dcg-noedit-branding") {
      /* @plugin show-tips

      @what Replace "powered by Desmos" branding with tips when tips are enabled

      @how
        Replaces
          // The original:
          DCGView.createElement(
            "span",
            { class: Dcgview.const("dcg-noedit-branding") },
            ...
          )
        with
          IfElse(
            () => DesModder.controller.isPluginEnabled("show-tips"),
            {
              false: () => // (The original) //,
              true: DesModder.view.createTipElement()
            }
          )
      */
      const createElementCall = containingCreateElementCall(path);
      if (createElementCall === null) return;
      createElementCall.replaceWith(
        template.expression(`
          %%DCGView%%.Components.IfElse(
            () => window.DesModder?.controller?.isPluginEnabled?.("show-tips"),
            {
              false: () => %%oldCEC%%,
              true: () => window.DesModder?.view?.createTipElement()
            }
          )
        `)({
          DCGView: dependencyNameMap.dcgview,
          oldCEC: createElementCall.node,
        })
      );
      createElementCall.skip();
    }
  },
});
