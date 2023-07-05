import { PluginID } from "../plugins";
import { onStateChange, skipOnce } from "./utils";
import { Facet, StateEffect, StateField } from "@codemirror/state";
import { postMessageUp, mapToRecord } from "utils/messages";

export const setPluginsEnabled = StateEffect.define<Map<PluginID, boolean>>();
export const setPluginEnabled = StateEffect.define<{
  id: PluginID;
  enable: boolean;
}>();

export const pluginsEnabled = StateField.define<Map<PluginID, boolean>>({
  create: () => new Map(),
  update: (value, transaction) => {
    for (const e of transaction.effects) {
      if (e.is(setPluginsEnabled)) value = new Map(e.value);
      if (e.is(setPluginEnabled)) {
        value = new Map([...value, [e.value.id, e.value.enable]]);
      }
    }
    return value;
  },
});

const syncPluginsEnabled = onStateChange(
  pluginsEnabled,
  // Skip once since the state is updated once inside init.
  skipOnce((pluginsEnabled) => {
    postMessageUp({
      type: "set-plugins-enabled",
      value: mapToRecord(pluginsEnabled),
    });
  })
);

export const pluginsForceDisabled = Facet.define<Set<PluginID>, Set<PluginID>>({
  combine: (values) => new Set(values.flatMap((v) => [...v])),
  static: true,
});

export default [pluginsEnabled, syncPluginsEnabled];
