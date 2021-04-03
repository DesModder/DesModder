import DCGView from 'DCGView'

export default class Toggle extends DCGView.Class {
  template () {
    return (
      <div
        class={() => ({
          'dcg-toggle-view': true,
          'dcg-toggled': this.props.toggled()
        })}
        style={() => (
          this.props.disabled()
            ? {
                opacity: 0.3,
                cursor: 'not-allowed'
              }
            : {}
        )}
        onTap={() => this.props.onChange()}
      >
        <div class='dcg-toggle-switch' />
      </div>
    )
  }
}
