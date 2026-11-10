import { Inserter, PluginController } from "#plugins/PluginController.ts";
import { jsx } from "#DCGView";
import ColorField from "./ColorField";

export default class ColorInput extends PluginController {
  static id = "color-input" as const;
  static enabledByDefault = false;
  dispatcher: string = "";

  insertColorInput(id: string): Inserter {
    return () => <ColorField ci={this} id={id} />;
  }
}
