import DCGView from "DCGView";
import Toggle from "./Toggle";
import Controller from "Controller";
import { If } from "./desmosComponents";
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
                  </div>
                )}
              </If>
            }
          </div>
        ))}
      </div>
    );
  }
}
