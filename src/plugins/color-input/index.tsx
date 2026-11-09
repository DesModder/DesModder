import { Inserter, PluginController } from "#plugins/PluginController.ts";
import { jsx } from "#DCGView";
import ColorField from "./ColorField";
import { ExpressionModel } from "#globals";

export default class ColorInput extends PluginController {
  static id = "color-input" as const;
  static enabledByDefault = false;
  exprModel: ExpressionModel | undefined;
  dispatcher: string = "";

  insertColorInput: Inserter = () => <ColorField ci={this} />;

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
