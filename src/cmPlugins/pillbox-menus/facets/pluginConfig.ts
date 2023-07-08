import { Facet } from "@codemirror/state";
import { ConfigItem, PluginID } from "plugins";

export const pluginConfig = Facet.define<PluginConfig, ConfigTree>({
  combine: (values) => {
    const tree: ConfigTree = {};
    for (const { id, category, config } of values) {
      tree[category] ??= {};
      tree[category][id] = config;
    }
    return tree;
  },
  static: true,
});

export interface PluginConfig {
  id: PluginID;
  category: string;
  config: readonly ConfigItem[];
}

/** string -> id -> config */
export type ConfigTree = Record<
  string,
  Partial<Record<PluginID, readonly ConfigItem[]>>
>;
