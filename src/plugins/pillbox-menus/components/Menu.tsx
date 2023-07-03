import PillboxMenus from "..";
import "./Menu.less";
import { Component, jsx } from "DCGView";
import Toggle from "components/Toggle";
import {
  If,
  Switch,
  Checkbox,
  Tooltip,
  For,
} from "components/desmosComponents";
import { format } from "i18n/i18n-core";
import {
  ConfigItem,
  ConfigItemString,
  GenericSettings,
  SpecificPlugin,
  PluginID,
  plugins,
  ConfigItemStringArray,
} from "plugins";
import { IndexFor } from "utils/utilComponents";

export function MenuFunc(controller: PillboxMenus) {
  return <Menu controller={controller} />;
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
    "my-expressions-library",
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
  controller: PillboxMenus;
}> {
  controller!: PillboxMenus;

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
            toggled={() =>
              this.controller.controller.isPluginEnabled(plugin.id)
            }
            disabled={() =>
              !this.controller.controller.isPluginToggleable(plugin.id)
            }
            onChange={() => this.controller.controller.togglePlugin(plugin.id)}
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
    const plugin = plugins.get(this.controller.expandedPlugin);
    if (plugin?.config === undefined) return null;
    const pluginSettings =
      this.controller.controller.pluginSettings[this.controller.expandedPlugin];
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
                    stringArray: stringArrayOption,
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

let counter = 0;
function stringArrayOption(
  controller: PillboxMenus,
  item: ConfigItem,
  plugin: SpecificPlugin,
  settings: GenericSettings
) {
  const option = item as ConfigItemStringArray;

  function set(newValue: readonly (readonly [string, number])[]) {
    controller.expandedPlugin &&
      controller.controller.setPluginSetting(
        controller.expandedPlugin,
        item.key,
        newValue
      );
  }

  function get() {
    return settings[item.key] as [string, number][];
  }

  const inputHandler = (index: () => number) => (evt: InputEvent) => {
    const newValue = get().map((e, i) =>
      i === index()
        ? ([(evt.target as HTMLTextAreaElement).value, e[1]] as const)
        : e
    );
    set(newValue);
  };

  const keydownHandler = (index: () => number) => (evt: KeyboardEvent) => {
    if (evt.key === "Enter") {
      const val = get();
      set([
        ...val.slice(0, index() + 1),
        ["", val.reduce((prev, [_, key]) => Math.max(prev, key), 0) + 1],
        ...val.slice(index() + 1),
      ]);
      evt.preventDefault();
      evt.target?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" })
      );
      return false;
    }

    if (evt.key === "ArrowDown") {
      const elem = evt.target;
      if (
        elem instanceof HTMLElement &&
        elem.nextElementSibling instanceof HTMLTextAreaElement
      )
        elem.nextElementSibling.focus();
    }

    if (evt.key === "ArrowUp") {
      const elem = evt.target;
      if (
        elem instanceof HTMLElement &&
        elem.previousElementSibling instanceof HTMLTextAreaElement
      )
        elem.previousElementSibling.focus();
    }

    if (
      evt.key === "Backspace" &&
      evt.target instanceof HTMLTextAreaElement &&
      evt.target.value === ""
    ) {
      const val = get();
      evt.target?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp" })
      );
      set([...val.slice(0, index()), ...val.slice(index() + 1)]);
    }
  };

  return (
    // not worrying about keys bc strings are cheap
    <div class="dsm-settings-item dsm-settings-string-array">
      <IndexFor
        each={() => get()}
        key={(e) => e[1]}
        innerComponent={(children) => <div>{children}</div>}
      >
        {(e: [string, number], i: () => number) => {
          return (
            <textarea
              rows={1}
              onChange={inputHandler(i)}
              onKeydown={keydownHandler(i)}
            >
              {() => e[0]}
            </textarea>
          );
        }}
      </IndexFor>
      <Tooltip tooltip={configItemDesc(plugin, item)} gravity="n">
        <div class="dsm-settings-label">{configItemName(plugin, item)}</div>
      </Tooltip>
      <ResetButton controller={controller} key={item.key} />
    </div>
  );
}

function booleanOption(
  controller: PillboxMenus,
  item: ConfigItem,
  plugin: SpecificPlugin,
  settings: GenericSettings
) {
  const toggle = () =>
    controller.expandedPlugin &&
    controller.controller.togglePluginSettingBoolean(
      controller.expandedPlugin,
      item.key
    );
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

function stringOption(
  controller: PillboxMenus,
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
          controller.expandedPlugin &&
          controller.controller.setPluginSetting(
            controller.expandedPlugin,
            item.key,
            (evt.target as HTMLInputElement).value
          )
        }
        onInput={(evt: Event) =>
          controller.expandedPlugin &&
          controller.controller.setPluginSetting(
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
  controller: PillboxMenus;
  key: string;
}> {
  controller!: PillboxMenus;
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
