import { ConfigItem, GenericSettings } from ".";
import DSM from "MainController";

export class PluginController<
  Settings extends GenericSettings | undefined = undefined
> {
  static descriptionLearnMore?: string = undefined;
  static forceEnabled?: boolean = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;
  static hasSettingsImportExportWidget: boolean = false;
  static settingsImportWidgetData = {
    copyToClipboardButton: "import-export-settings-copy-to-clipboard",
    importButton: "import-export-settings-import",
  };
  static settingsSavedStatesWidget = {
    enabled: false,
    nameKey: "name",
    savedStatesKey: "savedStates",
  };

  constructor(readonly dsm: DSM, public settings: Settings) {}

  afterEnable() {}
  afterConfigChange() {}
  beforeDisable() {}
  afterDisable() {}
}

export type Replacer<T = any> = undefined | ((old: T) => any);
export type Inserter = undefined | (() => any);
