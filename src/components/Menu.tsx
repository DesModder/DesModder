import { ConfigItem, ConfigItemString, Plugin } from "../plugins";
import "./Menu.less";
import Toggle from "./Toggle";
import { If, Switch, Checkbox, Tooltip } from "./desmosComponents";
import { Component, jsx } from "DCGView";
import { format } from "i18n/i18n-core";
import Controller from "main/Controller";

export function MenuFunc(controller: Controller) {
  return <Menu controller={controller} />;
}

export default class Menu extends Component<{
  controller: Controller;
}> {
  controller!: Controller;

  init() {
    this.controller = this.props.controller();
  }

  template() {
    return (
      <div class="dcg-popover-interior">
        <div class="dcg-group-title">{format("menu-desmodder-plugins")}</div>
        {this.controller.getPluginsList().map((plugin) => (
          <div
            class="dcg-options-menu-section dsm-plugin-section"
            key={plugin.id}
          >
            <div class="dcg-options-menu-section-title dsm-plugin-title-bar">
              <div
                class="dsm-plugin-header"
                onClick={() => this.controller.togglePluginExpanded(plugin.id)}
              >
                <div
                  class={() => ({
                    "dsm-caret-container": true,
                    "dsm-caret-expanded":
                      plugin.id === this.controller.expandedPlugin,
                  })}
                >
                  <i class="dcg-icon-chevron-down" />
                </div>
                <div class="dsm-plugin-name">{pluginDisplayName(plugin)}</div>
              </div>
              <Toggle
                toggled={() => this.controller.isPluginEnabled(plugin.id)}
                disabled={() => !this.controller.isPluginToggleable(plugin.id)}
                onChange={() => this.controller.togglePlugin(plugin.id)}
              />
            </div>
            {
              <If
                predicate={() => plugin.id === this.controller.expandedPlugin}
              >
                {() => (
                  <div class="dsm-plugin-info-body">
                    <div class="dsm-plugin-description">
                      {pluginDesc(plugin)}
                      <If
                        predicate={() =>
                          (plugin as Plugin).descriptionLearnMore !== undefined
                        }
                      >
                        {() => (
                          <a
                            href={() => (plugin as Plugin).descriptionLearnMore}
                            target="_blank"
                            onTap={(e: MouseEvent) => e.stopPropagation()}
                          >
                            {" "}
                            {format("menu-learn-more")}
                          </a>
                        )}
                      </If>
                    </div>
                    {this.getExpandedSettings()}
                  </div>
                )}
              </If>
            }
          </div>
        ))}
      </div>
    );
  }

  getExpandedSettings() {
    if (this.controller.expandedPlugin === null) return null;
    const plugin = this.controller.getPlugin(this.controller.expandedPlugin);
    if (plugin?.config === undefined) return null;
    const pluginSettings =
      this.controller.pluginSettings[this.controller.expandedPlugin];
    if (pluginSettings === undefined) return null;
    return (
      <div>
        {plugin.config.map((item) => (
          <If predicate={() => item.shouldShow?.(pluginSettings) ?? true}>
            {() => (
              <Switch key={() => item.type}>
                {() =>
                  ({
                    boolean: booleanOption,
                    string: stringOption,
                  }[item.type](this.controller, item, plugin, pluginSettings))
                }
              </Switch>
            )}
          </If>
        ))}
      </div>
    );
  }
}

function booleanOption(controller: any, item: any, plugin: any, settings: any) {
  return (
    <div class="dsm-settings-item dsm-settings-boolean">
      <Checkbox
        onChange={(checked) =>
          controller.expandedPlugin &&
          controller.setPluginSetting(
            controller.expandedPlugin,
            item.key,
            checked
          )
        }
        checked={() => (settings[item.key] as boolean) ?? false}
        ariaLabel={() => item.key}
      >
        <Tooltip tooltip={configItemDesc(plugin, item)} gravity="n">
          <div class="dsm-settings-label">{configItemName(plugin, item)}</div>
        </Tooltip>
      </Checkbox>
      <ResetButton controller={controller} key={item.key} />
    </div>
  );
}

function stringOption(controller: any, item: any, plugin: any, settings: any) {
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
          controller.expandedPlugin &&
          controller.setPluginSetting(
            controller.expandedPlugin,
            item.key,
            (evt.target as HTMLInputElement).value
          )
        }
        onInput={(evt: Event) =>
          controller.expandedPlugin &&
          controller.setPluginSetting(
            controller.expandedPlugin,
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
      <ResetButton controller={controller} key={item.key} />
    </div>
  );
}

class ResetButton extends Component<{
  controller: Controller;
  key: string;
}> {
  controller!: Controller;
  key!: string;

  init() {
    this.controller = this.props.controller();
    this.key = this.props.key();
  }

  template() {
    return (
      <If predicate={() => this.controller.canResetSetting(this.key)}>
        {() => (
          <div
            class="dsm-reset-btn"
            role="button"
            onTap={() => this.controller.resetSetting(this.key)}
          >
            <i class="dcg-icon-reset" />
          </div>
        )}
      </If>
    );
  }
}

function pluginDisplayName(plugin: Plugin) {
  return format(plugin.id + "-name");
}

function pluginDesc(plugin: Plugin) {
  return format(plugin.id + "-desc");
}

function configItemDesc(plugin: Plugin, item: ConfigItem) {
  return format(plugin.id + "-opt-" + item.key + "-desc");
}

function configItemName(plugin: Plugin, item: ConfigItem) {
  return format(plugin.id + "-opt-" + item.key + "-name");
}
