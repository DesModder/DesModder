import { ConfigItem } from ".";
import MainController from "main/Controller";

export class PluginController {
  static descriptionLearnMore?: string = undefined;
  static forceEnabled?: boolean = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;

  constructor(readonly controller: MainController) {}

  afterEnable(_config: any) {}
  beforeDisable() {}
  afterDisable() {}
  onConfigChange(_config: any) {}
}
