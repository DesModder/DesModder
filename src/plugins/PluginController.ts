import { ConfigItem, GenericSettings } from ".";
import MainController from "main/Controller";

export class PluginController<
  Settings extends GenericSettings | undefined = undefined
> {
  static descriptionLearnMore?: string = undefined;
  static forceEnabled?: boolean = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;

  constructor(readonly controller: MainController, public settings: Settings) {}

  afterEnable() {}
  afterConfigChange() {}
  beforeDisable() {}
  afterDisable() {}
}
