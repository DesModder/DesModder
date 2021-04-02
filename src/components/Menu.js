import DCGView from 'DCGView'
import { Tooltip, Toggle } from './desmosComponents'

export default class MenuContainer extends DCGView.Class {
  init () {
    this.controller = this.props.controller()
  }

  template () {
    const plugins = this.controller.getPlugins()
    return (
      <div class='dcg-popover-interior'>
        <div>
          <Tooltip
            tooltip={plugins[0].description}
          >
            {plugins[0].name}
          </Tooltip>
          <Toggle
            toggled={() => this.controller.isPluginEnabled(0)}
            ariaLabel={`Toggle ${plugins[0].name}`}
            onChange={() => this.controller.togglePlugin(0)}
          />
        </div>
      </div>
    )
  }
}
