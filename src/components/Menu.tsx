import {
  ConfigItem,
  ConfigItemString,
  Plugin,
  PluginID,
  plugins,
} from "../plugins";
import "./Menu.less";
import Toggle from "./Toggle";
import { If, Switch, Checkbox, Tooltip, For } from "./desmosComponents";
import { Component, jsx } from "DCGView";
import { format } from "i18n/i18n-core";
import Controller from "main/Controller";

export function MenuFunc(controller: Controller) {
  return <Menu controller={controller} />;
}

const categoryPlugins: Record<string, PluginID[]> = {
  core: ["builtin-settings", "GLesmos", "video-creator", "text-mode"],
  utility: [
    "wolfram2desmos",
    "pin-expressions",
    "find-and-replace",
    "performance-info",
    "right-click-tray",
    "duplicate-expression-hotkey",
    "shift-enter-newline",
    "folder-tools",
  ],
  visual: [
    "set-primary-color",
    "debug-mode",
    "better-evaluation-view",
    "show-tips",
    "hide-errors",
  ],
  integrations: ["wakatime"],
};

const categories = ["core", "utility", "visual", "integrations"];

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
                  "dsm-expanded": this.controller.isCategoryExpanded(category),
                })}
                onClick={() => this.controller.toggleCategoryExpanded(category)}
              >
                <div
                  class={() => ({
                    "dsm-caret-container": true,
                    "dsm-caret-expanded":
                      this.controller.isCategoryExpanded(category),
                  })}
                >
                  <i class="dcg-icon-caret-down" />
                </div>
                <div>{categoryDisplayName(category)}</div>
              </div>
            </div>
            <If predicate={() => this.controller.isCategoryExpanded(category)}>
              {() => (
                <For each={() => categoryPlugins[category]} key={(id) => id}>
                  <div class="dsm-category-container">
                    {(pluginID: string) => this.plugin(plugins.get(pluginID)!)}
                  </div>
                </For>
              )}
            </If>
          </div>
        ))}
      </div>
    );
  }

  plugin(plugin: Plugin) {
    return (
      <div class="dcg-options-menu-section dsm-plugin-section" key={plugin.id}>
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
              <i class="dcg-icon-caret-down" />
            </div>
            <div>{pluginDisplayName(plugin)}</div>
          </div>
          <Toggle
            toggled={() => this.controller.isPluginEnabled(plugin.id)}
            disabled={() => !this.controller.isPluginToggleable(plugin.id)}
            onChange={() => this.controller.togglePlugin(plugin.id)}
          />
        </div>
        {
          <If predicate={() => plugin.id === this.controller.expandedPlugin}>
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
                {this.getExpandedSettings()}
              </div>
            )}
          </If>
        }
      </div>
    );
  }

  getExpandedSettings() {
    if (this.controller.expandedPlugin === null) return null;
    const plugin = this.controller.getPlugin(this.controller.expandedPlugin);
    if (plugin?.config === undefined) return null;
    const pluginSettings = this.controller.pluginSettings.get(
      this.controller.expandedPlugin
    );
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
  const toggle = () =>
    controller.expandedPlugin &&
    controller.togglePluginSettingBoolean(controller.expandedPlugin, item.key);
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

function categoryDisplayName(id: string) {
  return format("category-" + id + "-name");
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
