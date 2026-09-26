import { PluginController, Replacer } from "#plugins/PluginController.ts";
import { ComponentTemplate, jsx } from "#DCGView";
import ColorField from "./ColorField";
import { ExpressionModel } from "#globals";

export default class ColorInput extends PluginController {
  static id = "color-input" as const;
  static enabledByDefault = false;
  exprModel: ExpressionModel | undefined;
  dispatcher: string = "";

  getColorLatex(): string {
    return this.exprModel?.colorLatex ?? "";
  }

  setColorLatex(latex: string) {
    if (this.exprModel) {
      this.exprModel.colorLatex = latex;
      this.cc.dispatch({ type: "tick" });
    }
  }

  hasError(): boolean {
    return !this.exprModel?.formula?.color_latex_valid;
  }

  getPlaceholder(): string {
    if (!this.exprModel?.color) {
      return "";
    }

    const hexColor = parseInt(this.exprModel.color.slice(1), 16);
    const r = (hexColor >> 16) & 255;
    const g = (hexColor >> 8) & 255;
    const b = hexColor & 255;
    return `\\operatorname{rgb}\\left(${r},${g},${b}\\right)`;
  }

  replaceColorView: Replacer = (ColorPicker: ComponentTemplate) => (
    <div>
      {ColorPicker}
      <ColorField ci={this} />
    </div>
  );

  afterEnable() {
    this.dispatcher = this.cc.dispatcher.register((e) => {
      if (e.type === "toggle-item-settings-menu") {
        this.exprModel = this.cc.getItemModel(e.menu.id) as
          | ExpressionModel
          | undefined;
      }
    });
  }

  afterDisable() {
    this.cc.dispatcher.unregister(this.dispatcher);
  }
}
