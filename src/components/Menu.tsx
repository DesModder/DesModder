import DCGView from "DCGView";
import Toggle from "./Toggle";
import Controller from "main/Controller";
import { If, Switch, Checkbox, Tooltip } from "./desmosComponents";
import "./Menu.less";

export function MenuFunc(controller: Controller) {
  return <Menu controller={controller} />;
}

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
                        checked={() => pluginSettings[item.key] ?? false}
                        ariaLabel={() => item.key}
                      >
                        <Tooltip tooltip={item.description ?? ""} gravity="n">
                          <div class="dsm-settings-label">{item.name}</div>
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
