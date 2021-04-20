import DCGView from "DCGView";
import Toggle from "./Toggle";
import Controller from "Controller";
import { If, Switch, Checkbox, Tooltip } from "./desmosComponents";
import "./Menu.less";

export default class Menu extends DCGView.Class<{
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
        {this.controller.getPlugins().map((plugin, pluginIndex) => (
          <div
            class="dcg-options-menu-section desmodder-plugin-section"
            key={pluginIndex}
          >
            <div class="dcg-options-menu-section-title desmodder-plugin-title-bar">
              <div
                class="desmodder-plugin-header"
                onClick={() =>
                  this.controller.togglePluginExpanded(pluginIndex)
                }
              >
                <div
                  class={() => ({
                    "desmodder-caret-container": true,
                    "desmodder-caret-expanded":
                      pluginIndex === this.controller.expandedPlugin,
                  })}
                >
                  <i class="dcg-icon-chevron-down" />
                </div>
                <div class="desmodder-plugin-name"> {plugin.name} </div>
              </div>
              <Toggle
                toggled={() => this.controller.isPluginEnabled(pluginIndex)}
                disabled={() => !this.controller.canTogglePlugin(pluginIndex)}
                onChange={() => this.controller.togglePlugin(pluginIndex)}
              />
            </div>
            {
              <If
                predicate={() => pluginIndex === this.controller.expandedPlugin}
              >
                {() => (
                  <div class="desmodder-plugin-info-body">
                    <div class="desmodder-plugin-description">
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
    const plugin = this.controller.plugins[this.controller.expandedPlugin];
    if (plugin === undefined) return null;
    const config = plugin.config;
    if (config !== undefined) {
      const pluginSettings = this.controller.pluginSettings.get(
        this.controller.expandedPlugin
      );
      if (pluginSettings === undefined) return null;
      return (
        <div>
          {config.map((item) => (
            <Switch key={() => item.type}>
              {() =>
                ({
                  boolean: () => (
                    <div class="desmodder-settings-item desmodder-settings-boolean">
                      <Checkbox
                        onChange={(checked) =>
                          this.controller.setPluginSetting(
                            this.controller.expandedPlugin ?? -1,
                            item.key,
                            checked
                          )
                        }
                        checked={() => pluginSettings[item.key] ?? false}
                        ariaLabel={() => item.key}
                        green
                      >
                        <Tooltip tooltip={item.description ?? ""} gravity="n">
                          <div class="desmodder-settings-label">
                            {item.name}
                          </div>
                        </Tooltip>
                      </Checkbox>
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
