import DCGView from "DCGView";
import { Tooltip } from "./desmosComponents";
import Toggle from "./Toggle";
import Controller from "Controller";
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
      // TODO: add a style loader instead of repeated inline CSS
      <div class="dcg-popover-interior">
        <div class="dcg-group-title">DesModder plugins</div>
        {this.controller.getPlugins().map((plugin, pluginIndex) => (
          <div
            class="dcg-options-menu-section desmodder-plugin-section"
            key={pluginIndex}
          >
            <div class="dcg-options-menu-section-title desmodder-plugin-title">
              <Tooltip tooltip={plugin.description}>{plugin.name}</Tooltip>
              <Toggle
                toggled={() => this.controller.isPluginEnabled(pluginIndex)}
                disabled={() => !this.controller.canTogglePlugin(pluginIndex)}
                onChange={() => this.controller.togglePlugin(pluginIndex)}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
}
