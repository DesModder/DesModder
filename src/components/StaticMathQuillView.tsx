import DCGView from 'DCGView'
import { DStaticMathquillView } from './desmosComponents'

export default class StaticMathquillView extends DCGView.Class<{
  latex: string
}> {
  template () {
    return (
      <DStaticMathquillView
        latex={this.props.latex()}
        config={{}}
      />
    )
  }
}
