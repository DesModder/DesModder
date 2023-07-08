import { StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  PluginID,
  IDToPluginSettings,
  pluginList,
  GenericSettings,
  getPlugin,
} from "plugins";
import { postMessageUp } from "utils/messages";

export const applyStoredSettings =
  StateEffect.define<Map<PluginID, GenericSettings | undefined>>();
export const updatePluginSettings = StateEffect.define<{
  pluginID: PluginID;
  value: any;
  temporary: boolean;
}>();
export const cleanedUp = StateEffect.define();

export const pluginSettings = StateField.define<{
  settings: IDToPluginSettings;
  dirty: boolean;
}>({
  create: () => ({
    settings: Object.fromEntries(
      pluginList.map(
        (plugin) => [plugin.id, getDefaultConfig(plugin.id)] as const
      )
    ) satisfies IDToPluginSettings,
    dirty: false,
  }),
  update: (value, transaction) => {
    for (const e of transaction.effects) {
      if (e.is(applyStoredSettings)) {
        value = structuredClone(value);
        const storedSettings = e.value;
        for (const { id } of pluginList) {
          const stored = storedSettings.get(id);
          if (stored !== undefined) {
            const settings = value.settings[id];
            for (const key in settings) {
              const storedValue = stored[key];
              if (storedValue !== undefined) {
                settings[key] = storedValue;
              }
            }
          }
        }
      }
      if (e.is(updatePluginSettings)) {
        value = structuredClone(value);
        const { pluginID, value: v, temporary } = e.value;
        const settings = value.settings[pluginID];
        if (!settings) continue;
        Object.assign(settings, v);
        if (!temporary) value.dirty = true;
      }
      if (e.is(cleanedUp)) {
        value = {
          ...value,
          dirty: false,
        };
      }
    }
    return value;
  },
});

const syncPluginSettings = EditorView.updateListener.of((update) => {
  const settings = update.state.field(pluginSettings);
  if (settings.dirty) enqueueSetPluginSettingsMessage(update.view);
});

let timeoutInProgress: boolean = false;
function enqueueSetPluginSettingsMessage(view: EditorView) {
  if (!timeoutInProgress) {
    timeoutInProgress = true;
    setTimeout(() => {
      timeoutInProgress = false;
      view.dispatch({ effects: cleanedUp.of(null) });
      const value = view.state.field(pluginSettings).settings;
      postMessageUp({ type: "set-plugin-settings", value });
    }, 1000);
  }
}

function getDefaultConfig(id: PluginID) {
  const out: GenericSettings = {};
  const config = getPlugin(id)?.config;
  if (config !== undefined) {
    for (const configItem of config) {
      out[configItem.key] = configItem.default;
    }
  }
  return out;
}

export default [pluginSettings, syncPluginSettings];
