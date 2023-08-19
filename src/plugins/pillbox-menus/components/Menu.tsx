import PillboxMenus from "..";
import "./Menu.less";
import { parseSavedState, serializeSavedState } from "./saved-state-utils";
import { Component, jsx } from "DCGView";
import { IconButton } from "components";
import Toggle from "components/Toggle";
import {
  If,
  Switch,
  Checkbox,
  Tooltip,
  For,
} from "components/desmosComponents";
import { Calc } from "globals/window";
import { format } from "i18n/i18n-core";
import {
  ConfigItem,
  ConfigItemString,
  GenericSettings,
  SpecificPlugin,
  PluginID,
  plugins,
  ConfigItemNumber,
} from "plugins";

export function MenuFunc(pm: PillboxMenus) {
  return <Menu pm={pm} />;
}

const categoryPlugins: Record<string, PluginID[]> = {
  core: [
    "builtin-settings",
    "GLesmos",
    "video-creator",
    "text-mode",
    "intellisense",
  ],
  utility: [
    "wolfram2desmos",
    "pin-expressions",
    "find-and-replace",
    "performance-info",
    "right-click-tray",
    "duplicate-expression-hotkey",
    "shift-enter-newline",
    "folder-tools",
    "custom-mathquill-config",
  ],
  visual: [
    "set-primary-color",
    "debug-mode",
    "better-evaluation-view",
    "show-tips",
    "hide-errors",
    "compact-view",
    "multiline",
    "color-themes",
  ],
  integrations: ["wakatime"],
};

const categories = ["core", "utility", "visual", "integrations"];

export default class Menu extends Component<{
  pm: PillboxMenus;
}> {
  pm!: PillboxMenus;

  init() {
    this.pm = this.props.pm();
  }

  template() {
    return (
      <div class="dcg-popover-interior">
        <div class="dcg-popover-title">{format("menu-desmodder-plugins")}</div>
        {categories.map((category) => (
          <div
            class="dcg-options-menu-section dsm-category-section"
            key={category}
          >
            <div class="dcg-options-menu-section-title dsm-plugin-title-bar">
              <div
                class={() => ({
                  "dsm-category-header": true,
                  "dsm-expanded": this.pm.isCategoryExpanded(category),
                })}
                onClick={() => this.pm.toggleCategoryExpanded(category)}
              >
                <div
                  class={() => ({
                    "dsm-caret-container": true,
                    "dsm-caret-expanded": this.pm.isCategoryExpanded(category),
                  })}
                >
                  <i class="dcg-icon-caret-down" />
                </div>
                <div>{categoryDisplayName(category)}</div>
              </div>
            </div>
            <If predicate={() => this.pm.isCategoryExpanded(category)}>
              {() => (
                <For each={() => categoryPlugins[category]} key={(id) => id}>
                  <div class="dsm-category-container">
                    {(pluginID: PluginID) =>
                      this.plugin(plugins.get(pluginID)!)
                    }
                  </div>
                </For>
              )}
            </If>
          </div>
        ))}
      </div>
    );
  }

  plugin(plugin: SpecificPlugin) {
    return (
      <div class="dcg-options-menu-section dsm-plugin-section" key={plugin.id}>
        <div class="dcg-options-menu-section-title dsm-plugin-title-bar">
          <div
            class="dsm-plugin-header"
            onClick={() => this.pm.togglePluginExpanded(plugin.id)}
          >
            <div
              class={() => ({
                "dsm-caret-container": true,
                "dsm-caret-expanded": plugin.id === this.pm.expandedPlugin,
              })}
            >
              <i class="dcg-icon-caret-down" />
            </div>
            <div>{pluginDisplayName(plugin)}</div>
          </div>
          <Toggle
            toggled={() => this.pm.dsm.isPluginEnabled(plugin.id)}
            disabled={() => !this.pm.dsm.isPluginToggleable(plugin.id)}
            onChange={() => this.pm.dsm.togglePlugin(plugin.id)}
          />
        </div>
        {
          <If predicate={() => plugin.id === this.pm.expandedPlugin}>
            {() => (
              <div class="dsm-plugin-info-body">
                <div class="dsm-plugin-description">
                  {pluginDesc(plugin)}
                  <If
                    predicate={() => plugin.descriptionLearnMore !== undefined}
                  >
                    {() => (
                      <a
                        href={() => plugin.descriptionLearnMore}
                        target="_blank"
                        onTap={(e: MouseEvent) => e.stopPropagation()}
                      >
                        {" "}
                        {format("menu-learn-more")}
                      </a>
                    )}
                  </If>
                </div>
                {plugin.hasSettingsImportExportWidget &&
                this.pm.expandedPlugin ? (
                  <SettingsImportExportWidget
                    pm={() => this.pm}
                    plugin={() => plugin}
                    settings={() =>
                      this.pm.dsm.pluginSettings[
                        this.pm.expandedPlugin as Exclude<
                          typeof this.pm.expandedPlugin,
                          null
                        >
                      ] ?? {}
                    }
                  ></SettingsImportExportWidget>
                ) : (
                  ""
                )}
                {plugin.settingsSavedStatesWidget.enabled ? (
                  <SavedStatesWidget
                    pm={() => this.pm}
                    plugin={() => plugin}
                    settings={() =>
                      this.pm.dsm.pluginSettings[
                        this.pm.expandedPlugin as Exclude<
                          typeof this.pm.expandedPlugin,
                          null
                        >
                      ] ?? {}
                    }
                  ></SavedStatesWidget>
                ) : (
                  ""
                )}
                {this.getExpandedSettings()}
              </div>
            )}
          </If>
        }
      </div>
    );
  }

  getExpandedSettings() {
    if (this.pm.expandedPlugin === null) return null;
    const plugin = plugins.get(this.pm.expandedPlugin);
    if (plugin?.config === undefined) return null;
    const pluginSettings = this.pm.dsm.pluginSettings[this.pm.expandedPlugin];
    if (pluginSettings === undefined) return null;
    return (
      <div>
        {plugin.config.map((item: ConfigItem) => (
          <If predicate={() => item.shouldShow?.(pluginSettings) ?? true}>
            {() => (
              <Switch key={() => item.type}>
                {() =>
                  ({
                    boolean: booleanOption,
                    string: stringOption,
                    number: numberOption,
                  }[item.type](this.pm, item, plugin, pluginSettings))
                }
              </Switch>
            )}
          </If>
        ))}
      </div>
    );
  }
}

function assertUnreachable(): never {
  throw new Error("Unreachable!");
}

function tryLoadingPotentiallyInvalidSettings(
  props: {
    pm: () => PillboxMenus;
    plugin: () => SpecificPlugin;
    settings: () => GenericSettings;
  },
  settingsData: any
) {
  const ep = props.pm().expandedPlugin;
  if (!ep) return;

  try {
    const showIncompatibleTypesWarning = () => {
      Calc.controller._showToast({
        message: format("import-export-settings-incompatible-types"),
      });
    };

    for (const configItem of props.plugin().config ?? []) {
      const data = settingsData[configItem.key];

      switch (configItem.type) {
        case "string":
        case "number":
        case "boolean":
          // eslint-disable-next-line valid-typeof
          if (typeof data === configItem.type) {
            props.pm().dsm.setPluginSetting(ep, configItem.key, data);
          } else {
            showIncompatibleTypesWarning();
          }
          break;
        default:
          return assertUnreachable();
      }
    }
  } catch (err) {
    Calc.controller._showToast({
      message: format("import-export-settings-failed-to-load", {
        pluginName: format(props.plugin().id + "-name"),
      }),
    });
    // eslint-disable-next-line no-console
    console.error("Error loading plugin settings:", err);
  }
}

class SavedStatesWidget extends Component<{
  pm: () => PillboxMenus;
  plugin: () => SpecificPlugin;
  settings: () => GenericSettings;
}> {
  template() {
    const getSavedStates = () => {
      const ep = this.props.pm().expandedPlugin;
      if (!ep) return {};
      return parseSavedState(
        this.props.settings()[
          this.props.plugin().settingsSavedStatesWidget.savedStatesKey
        ]
      );
    };

    return (
      <div class="dsm-saved-states-widget">
        <span>{format(this.props.plugin().id + "-settings-saved-states")}</span>
        <For each={() => Object.keys(getSavedStates())} key={(e) => e}>
          <ul>
            {(key: string) => {
              return (
                <li>
                  <button
                    onClick={() => {
                      tryLoadingPotentiallyInvalidSettings(
                        this.props,
                        getSavedStates()[key]
                      );
                    }}
                  >
                    {key}
                  </button>
                  <IconButton
                    iconClass={"dcg-icon-remove"}
                    onTap={() => {
                      const ep = this.props.pm().expandedPlugin;

                      if (!ep) return;

                      const savedStatesKey =
                        this.props.plugin().settingsSavedStatesWidget
                          .savedStatesKey;

                      const savedStates = parseSavedState(
                        this.props.settings()[savedStatesKey]
                      );

                      const newSavedStates = {
                        ...(typeof savedStates === "object" ? savedStates : {}),
                      };

                      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                      delete newSavedStates[key];

                      this.props
                        .pm()
                        .dsm.setPluginSetting(
                          ep,
                          savedStatesKey,
                          serializeSavedState(newSavedStates)
                        );
                    }}
                  ></IconButton>
                </li>
              );
            }}
          </ul>
        </For>
        <button
          class="dcg-btn-dark-on-gray dsm-settings-button"
          onClick={() => {
            const ep = this.props.pm().expandedPlugin;

            if (!ep) return;

            const newSavedState = {
              ...this.props.settings(),
            };

            const savedStatesKey =
              this.props.plugin().settingsSavedStatesWidget.savedStatesKey;
            newSavedState[savedStatesKey] = undefined;
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete newSavedState[savedStatesKey];

            const savedStates = parseSavedState(
              this.props.settings()[savedStatesKey]
            );

            const newSavedStates = {
              ...(savedStates && typeof savedStates === "object"
                ? savedStates
                : {}),
            };

            newSavedStates[
              newSavedState[
                this.props.plugin().settingsSavedStatesWidget.nameKey
              ]
            ] = {
              ...newSavedState,
              [savedStatesKey]: {},
            };

            try {
              this.props
                .pm()
                .dsm.setPluginSetting(
                  ep,
                  savedStatesKey,
                  serializeSavedState(newSavedStates)
                );
            } catch {
              Calc.controller._showToast({
                message: format(
                  this.props.plugin().id + "-failed-to-save-settings"
                ),
                hideAfter: -1,
              });
            }
          }}
        >
          {format(this.props.plugin().id + "-settings-save-current-state")}
        </button>
      </div>
    );
  }
}

class SettingsImportExportWidget extends Component<{
  pm: () => PillboxMenus;
  plugin: () => SpecificPlugin;
  settings: () => GenericSettings;
}> {
  settingsInClipboard: string = "";

  template() {
    return (
      <div class="dsm-settings-import-export-widget">
        <div class="copy-to-clipboard-section">
          <button
            class="dcg-btn-dark-on-gray dsm-settings-button"
            onClick={() => {
              void navigator.clipboard.writeText(
                JSON.stringify(this.props.settings())
              );
            }}
          >
            {format(
              this.props.plugin().settingsImportWidgetData.copyToClipboardButton
            )}
          </button>
        </div>
        <div class="import-section">
          <textarea
            value={() => this.settingsInClipboard}
            onChange={(evt: InputEvent) => {
              this.settingsInClipboard = (
                evt.target as HTMLTextAreaElement
              ).value;
            }}
            placeholder={format("import-export-settings-placeholder")}
          ></textarea>
          <button
            class="dcg-btn-dark-on-gray dsm-settings-button"
            onClick={async () => {
              const settingsString = this.settingsInClipboard;

              let settingsData: any;

              if (settingsString.startsWith("http")) {
                settingsData = await (await fetch(settingsString)).json();
              } else {
                settingsData = JSON.parse(settingsString);
              }

              tryLoadingPotentiallyInvalidSettings(this.props, settingsData);
            }}
          >
            {format(this.props.plugin().settingsImportWidgetData.importButton)}
          </button>
        </div>
      </div>
    );
  }
}

function numberOption(
  pm: PillboxMenus,
  item: ConfigItem,
  plugin: SpecificPlugin,
  settings: GenericSettings
) {
  const numItem = item as ConfigItemNumber;

  const inputHandler = (e: InputEvent) => {
    const value = Number((e.target as HTMLInputElement)?.value);
    if (!isNaN(value)) {
      pm.expandedPlugin &&
        pm.dsm.setPluginSetting(pm.expandedPlugin, item.key, value);
    }
  };

  return (
    <div class="dsm-settings-item dsm-settings-number">
      <input
        type={numItem.variant ?? "number"}
        min={() => numItem.min}
        max={() => numItem.max}
        step={() => numItem.step}
        value={settings[item.key]}
        onChange={inputHandler}
        onInput={inputHandler}
        id={`dsm-settings-item__input-${item.key}`}
        onUpdate={(e: HTMLInputElement) =>
          !e.classList.contains("dcg-hovered") &&
          (e.value = settings[item.key].toString())
        }
      ></input>
      <Tooltip tooltip={configItemDesc(plugin, item)} gravity="n">
        <label for={`dsm-settings-item__input-${item.key}`}>
          {configItemName(plugin, item)}
        </label>
      </Tooltip>
      <ResetButton pm={pm} key={item.key} />
    </div>
  );
}

function booleanOption(
  pm: PillboxMenus,
  item: ConfigItem,
  plugin: SpecificPlugin,
  settings: GenericSettings
) {
  const toggle = () =>
    pm.expandedPlugin &&
    pm.dsm.togglePluginSettingBoolean(pm.expandedPlugin, item.key);
  return (
    <div class="dsm-settings-item dsm-settings-boolean">
      <Checkbox
        onChange={toggle}
        checked={() => (settings[item.key] as boolean) ?? false}
        ariaLabel={() => item.key}
      ></Checkbox>
      <Tooltip tooltip={configItemDesc(plugin, item)} gravity="n">
        <div class="dsm-settings-label" onClick={toggle}>
          {configItemName(plugin, item)}
        </div>
      </Tooltip>
      <ResetButton pm={pm} key={item.key} />
    </div>
  );
}

function stringOption(
  pm: PillboxMenus,
  item: ConfigItem,
  plugin: SpecificPlugin,
  settings: GenericSettings
) {
  return (
    <div class="dsm-settings-item dsm-settings-color">
      <input
        type={(item as ConfigItemString).variant}
        id={`dsm-settings-item__input-${item.key}`}
        value={settings[item.key]}
        onUpdate={(e: HTMLInputElement) =>
          !e.classList.contains("dcg-hovered") &&
          (e.value = settings[item.key] as string)
        }
        onChange={(evt: Event) =>
          pm.expandedPlugin &&
          pm.dsm.setPluginSetting(
            pm.expandedPlugin,
            item.key,
            (evt.target as HTMLInputElement).value
          )
        }
        onInput={(evt: Event) =>
          pm.expandedPlugin &&
          pm.dsm.setPluginSetting(
            pm.expandedPlugin,
            item.key,
            (evt.target as HTMLInputElement).value,
            true
          )
        }
      />
      <Tooltip tooltip={configItemDesc(plugin, item)} gravity="n">
        <label for={`dsm-settings-item__input-${item.key}`}>
          {configItemName(plugin, item)}
        </label>
      </Tooltip>
      <ResetButton pm={pm} key={item.key} />
    </div>
  );
}

class ResetButton extends Component<{
  pm: PillboxMenus;
  key: string;
}> {
  pm!: PillboxMenus;
  key!: string;

  init() {
    this.pm = this.props.pm();
    this.key = this.props.key();
  }

  template() {
    return (
      <If predicate={() => this.pm.canResetSetting(this.key)}>
        {() => (
          <div
            class="dsm-reset-btn"
            role="button"
            onTap={() => this.pm.resetSetting(this.key)}
          >
            <i class="dcg-icon-reset" />
          </div>
        )}
      </If>
    );
  }
}

function categoryDisplayName(id: string) {
  return format("category-" + id + "-name");
}

function pluginDisplayName(plugin: SpecificPlugin) {
  return format(plugin.id + "-name");
}

function pluginDesc(plugin: SpecificPlugin) {
  return format(plugin.id + "-desc");
}

function configItemDesc(plugin: SpecificPlugin, item: ConfigItem) {
  return format(plugin.id + "-opt-" + item.key + "-desc");
}

function configItemName(plugin: SpecificPlugin, item: ConfigItem) {
  return format(plugin.id + "-opt-" + item.key + "-name");
}
