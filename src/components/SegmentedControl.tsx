import DCGView from 'DCGView'

export default class SegmentedControl extends DCGView.Class<{
  names: string[],
  selectedIndex: number,
  setSelectedIndex (i: number): void,
  class?: string
}> {
  template () {
    return (
      <div
        class={
          'dcg-segmented-control-container'
          + (this.props.class && this.props.class() ? ' ' + this.props.class() : '')}
        role='group'
      >
        {
          this.props.names().map((name, i) => (
            <div
              key={i}
              class={() => ({
                'dcg-segmented-control-btn': true,
                'dcg-dark-gray-segmented-control-btn': true,
                'dcg-selected dcg-active': i === this.props.selectedIndex()
              })}
              role='button'
              ariaLabel={name}
              onTap={() => this.props.setSelectedIndex(i)}
            >
              {name}
            </div>
          ))
        }
      </div>
    )
  }
}
