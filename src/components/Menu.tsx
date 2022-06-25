import { Component, jsx } from "DCGView";
import Toggle from "./Toggle";
import Controller from "main/Controller";
import { If, Switch, Checkbox, Tooltip } from "./desmosComponents";
import "./Menu.less";

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
        <div class="dcg-group-title">DesModder plugins</div>
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
                <div class="dsm-plugin-name"> {plugin.name} </div>
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
                      {plugin.description}
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
    if (plugin === undefined) return null;
    const config = plugin.config;
    if (config !== undefined) {
      const pluginSettings =
        this.controller.pluginSettings[this.controller.expandedPlugin];
      if (pluginSettings === undefined) return null;
      return (
        <div>
          {config.map((item) => (
            <Switch key={() => item.type}>
              {() =>
                ({
                  boolean: () => (
                    <div class="dsm-settings-item dsm-settings-boolean">
                      <Checkbox
                        onChange={(checked) =>
                          this.controller.expandedPlugin &&
                          this.controller.setPluginSetting(
                            this.controller.expandedPlugin,
                            item.key,
                            checked
                          )
                        }
                        checked={() =>
                          (pluginSettings[item.key] as boolean) ?? false
                        }
                        ariaLabel={() => item.key}
                      >
                        <Tooltip tooltip={item.description ?? ""} gravity="n">
                          <div class="dsm-settings-label">{item.name}</div>
                        </Tooltip>
                      </Checkbox>
                      <ResetButton
                        controller={this.controller}
                        key={item.key}
                      />
                    </div>
                  ),
                  color: () => (
                    <div class="dsm-settings-item dsm-settings-color">
                      <input
                        type="color"
                        id={`dsm-settings-item__input-${item.key}`}
                        value={pluginSettings[item.key]}
                        onUpdate={(e: HTMLInputElement) =>
                          !e.classList.contains("dcg-hovered") &&
                          (e.value = pluginSettings[item.key] as string)
                        }
                        onChange={(evt: Event) =>
                          this.controller.expandedPlugin &&
                          this.controller.setPluginSetting(
                            this.controller.expandedPlugin,
                            item.key,
                            (evt.target as HTMLInputElement).value
                          )
                        }
                        onInput={(evt: Event) =>
                          this.controller.expandedPlugin &&
                          this.controller.setPluginSetting(
                            this.controller.expandedPlugin,
                            item.key,
                            (evt.target as HTMLInputElement).value,
                            true
                          )
                        }
                      />
                      <label for={`dsm-settings-item__input-${item.key}`}>
                        {item.name}
                      </label>
                      <ResetButton
                        controller={this.controller}
                        key={item.key}
                      />
                    </div>
                  ),
                }[item.type]())
              }
            </Switch>
          ))}
        </div>
      );
    } else {
      // should never happen
      return null;
    }
  }
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
