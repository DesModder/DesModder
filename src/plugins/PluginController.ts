import { ConfigItem, GenericSettings } from ".";
import DSM from "#DSM";

export class PluginController<
  Settings extends GenericSettings | undefined = undefined,
> {
  static descriptionLearnMore?: string = undefined;
  static forceEnabled?: boolean = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;
  /** Core plugins get enabled before all others and can't be disabled. */
  static isCore = false;
  calc = this.dsm.calc;
  cc = this.calc.controller;

  constructor(readonly dsm: DSM, public settings: Settings) {}

  afterEnable() {}
  afterConfigChange() {}
  beforeDisable() {}
  afterDisable() {}
}

export type Replacer<T = any> = undefined | ((old: T) => any);
export type Inserter = undefined | (() => any);
