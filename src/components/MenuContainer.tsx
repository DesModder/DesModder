import DCGView from 'DCGView'
import { If, Tooltip } from './desmosComponents'
import Menu from './Menu'
import { jquery, keys } from 'utils'
import Controller from 'Controller'
import window from 'globals/window'

export default class MenuContainer extends DCGView.Class {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='desmodder-menu-view-container'>
        <Tooltip
          tooltip='DesModder menu'
          gravity='w'
        >
          <div
            class='dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings desmodder-action-menu'
            role='button'
            onTap={() => this.onTapMenuButton()}
            // TODO: manageFocus?
            style={{
              background: window.Calc.controller.getPillboxBackgroundColor()
            }}
          >
            <i class='dcg-icon-settings' />
          </div>
        </Tooltip>
        <If
          predicate={() => this.isMenuOpen()}
        >
          {
            () => (
              <div
                class='desmodder-view-container dcg-settings-container desmodder-menu-container dcg-left dcg-popover dcg-constrained-height-popover'
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: '38px',
                  'line-height': '1em'
                }}
                didMount={() => this.didMountContainer()}
                didUnmount={() => this.didUnmountContainer()}
                // TODO: didMount and didUnmount to register escape key → close
              >
                <Menu controller={this.controller} />
                <div class='dcg-arrow' />
              </div>
            )
          }
        </If>
      </div>
    )
  }

  isMenuOpen () {
    return this.controller.getMenuViewModel().isOpen
  }

  onTapMenuButton () {
    this.controller.toggleMenu()
  }

  didMountContainer () {
    if (window.Calc.controller.isGraphSettingsOpen()) {
      window.Calc.controller.dispatch({
        type: 'close-graph-settings'
      })
    }
    jquery(document).on('dcg-tapstart.menu-view wheel.menu-view', (e: Event) => {
      if (this.eventShouldCloseMenu(e)) {
        this.controller.closeMenu()
      }
    })
    jquery(document).on('keydown.menu-view', (e: KeyboardEvent) => {
      if (keys.lookup(e) === 'Esc') {
        this.controller.closeMenu()
      }
    })
  }

  didUnmountContainer () {
    jquery(document).off('.menu-view')
  }

  eventShouldCloseMenu (e: Event) {
    // this.node refers to the generated node from DCGView
    const el = jquery(e.target)
    return !el.closest(this._element._domNode).length &&
      !el.closest('.desmodder-action-menu').length
  }
}
