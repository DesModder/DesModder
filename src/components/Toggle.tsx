import "./Toggle.less";
import { Component, jsx } from "#DCGView";

export default class Toggle extends Component<{
  toggled: () => boolean;
  disabled: () => boolean;
  onChange: () => void;
}> {
  template() {
    return (
      <div
        class={() => ({
          "dcg-toggle-view": true,
          "dcg-toggled": this.props.toggled(),
          "dsm-disabled-toggle": this.props.disabled(),
        })}
        role={() => "checkbox"}
        tabIndex={0}
        aria-checked={this.props.toggled}
        onTap={() => this.props.onChange()}
      >
        <div class="dcg-toggle-track">
          <div class="dcg-toggle-switch" />
        </div>
      </div>
    );
  }
}
