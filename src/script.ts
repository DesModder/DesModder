import { format } from "./i18n/i18n-core";
import { drawGLesmosSketchToCtx } from "./plugins/GLesmos/drawGLesmosSketchToCtx";
import { DCGView } from "DCGView";
import ExpressionActionButton from "components/ExpressionActionButton";
import "fonts/style.css";
import window from "globals/window";
import MainController from "main/Controller";

const controller = new MainController();

window.DesModder = {
  controller,
  createAction(
    tooltip: string,
    buttonClass: string,
    iconClass: string,
    onTap: () => void
  ) {
    return () =>
      DCGView.createElement(ExpressionActionButton as any, {
        tooltip: DCGView.const(tooltip),
        buttonClass: DCGView.const(buttonClass),
        iconClass: DCGView.const(iconClass),
        onTap,
      });
  },
  format,
  drawGLesmosSketchToCtx,
  // Not used by DesModder, but some external scripts may still reference this
  exposedPlugins: controller.enabledPlugins,
};
window.DSM = controller;

controller.init();
