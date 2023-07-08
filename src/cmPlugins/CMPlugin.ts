import MainController from "../MainController";
import { ConfigItem } from "../plugins";
import { EditorView, ViewUpdate } from "@codemirror/view";

export class CMPlugin {
  static descriptionLearnMore?: string = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;

  constructor(public view: EditorView, public dsm: MainController) {}

  update(_update: ViewUpdate) {}
  destroy() {}

  /** Some warnings in case of mistakes */
  afterEnable(..._args: unknown[]): never {
    throw new Error(
      "Error: Used CMPlugin where a PluginController is expected."
    );
  }

  afterConfigChange = this.afterEnable.bind(this);
  beforeDisable = this.afterEnable.bind(this);
  afterDisable = this.afterEnable.bind(this);
}
