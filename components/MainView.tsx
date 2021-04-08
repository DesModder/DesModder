import {
  DCGView, If, Tooltip, Calc, jquery, keys
} from 'desmodder'
import Controller from '../Controller'
import MainPopup from './MainPopup'
import './MainView.css'

/*
  Much of the code is copied from Desmodder/src/components/MenuContainer.tsx.
  May want to modify into a component of some sort.
  Also see https://github.com/jared-hughes/DesModder/issues/11.
*/
export default class MainView extends DCGView.Class {
  controller!: Controller

  init () {
    this.controller = this.props.controller()
  }

  template () {
    return (
      <div class='gif-creator-main-view-container'>
        <Tooltip
          tooltip='GIF Creator menu'
          gravity='w'
        >
          <div
            class='dcg-btn-flat-gray dcg-settings-pillbox dcg-action-settings gif-creator-action-menu'
            role='button'
            onTap={() => this.onTapMenuButton()}
            // TODO: manageFocus?
            style={{
              background: Calc.controller.getPillboxBackgroundColor()
            }}
          >
            <i class='dcg-icon-film' />
          </div>
        </Tooltip>
        <If
          predicate={() => this.isMenuOpen()}
        >
          {
            () => (
              <div
                class='gif-creator-view-container dcg-settings-container dcg-left dcg-popover dcg-constrained-height-popover'
                didMount={() => this.didMountContainer()}
                didUnmount={() => this.didUnmountContainer()}
                // TODO: didMount and didUnmount to register escape key → close
              >
                <MainPopup controller={this.controller} />
                <div class='dcg-arrow' />
              </div>
            )
          }
        </If>
      </div>
    )
  }

  isMenuOpen () {
    return this.controller.isMainViewOpen
  }

  onTapMenuButton () {
    this.controller.toggleMainView()
  }

  didMountContainer () {
    if (Calc.controller.isGraphSettingsOpen()) {
      Calc.controller.dispatch({
        type: 'close-graph-settings'
      })
    }
    jquery(document).on('dcg-tapstart.gif-creator-main-view wheel.gif-creator-main-view', (e: Event) => {
      if (this.eventShouldCloseMenu(e)) {
        this.controller.closeMainView()
      }
    })
    jquery(document).on('keydown.gif-creator-main-view', (e: KeyboardEvent) => {
      if (keys.lookup(e) === 'Esc') {
        this.controller.closeMainView()
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
      !el.closest('.gif-creator-action-menu').length
  }
}
