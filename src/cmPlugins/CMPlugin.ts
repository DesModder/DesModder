import MainController from "../MainController";
import { GenericSettings } from "../plugins";
import { EditorView, ViewUpdate } from "@codemirror/view";

export class CMPlugin<
  Settings extends GenericSettings | undefined = undefined
> {
  static descriptionLearnMore?: string = undefined;
  static config: never;
  static category: never;

  constructor(public view: EditorView, public dsm: MainController) {}

  get settings() {
    return this.dsm.getPluginSettings((this.constructor as any).id) as Settings;
  }

  update(_update: ViewUpdate) {}
  destroy() {}

  /** Some warnings in case of mistakes */
  afterEnable(_arg1: unknown, ..._args: unknown[]): never {
    throw new Error(
      "Error: Used CMPlugin where a PluginController is expected."
    );
  }

  afterConfigChange = this.afterEnable.bind(this);
  beforeDisable = this.afterEnable.bind(this);
  afterDisable = this.afterEnable.bind(this);
}
