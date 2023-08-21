import { ConfigItem, GenericSettings } from ".";
import { FacetSourcesSpec, FacetsSpec } from "../dataflow";
import DSM from "MainController";

export class PluginController<
  Settings extends GenericSettings | undefined = undefined
> {
  static descriptionLearnMore?: string = undefined;
  static forceEnabled?: boolean = undefined;
  static config: readonly ConfigItem[] | undefined = undefined;

  constructor(readonly dsm: DSM, public settings: Settings) {}

  afterEnable() {}
  afterConfigChange() {}
  beforeDisable() {}
  afterDisable() {}

  facets: FacetsSpec = {};
  facetSources: FacetSourcesSpec = {};
  // computed is the same as facetSources but also adds an `x => x[0]` entry in `facets`
  computed: FacetSourcesSpec = {};
}

export type Replacer<T = any> = undefined | ((old: T) => any);
export type Inserter = undefined | (() => any);
