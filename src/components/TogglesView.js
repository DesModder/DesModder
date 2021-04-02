import DCGView from 'DCGView'
import { If } from './desmosComponents'

export default class TogglesView extends DCGView.Class {
  init () {

  }

  template () {
    return (
      <div>
        Test
        <If
          predicate={() => this.props.menuVisible()}
        >
          {
            () => (
              <div>
                Menu
              </div>
            )
          }
        </If>
      </div>
    )
  }
}
