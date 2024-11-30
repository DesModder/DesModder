import "./SegmentedControl.less";
import { DesmosSegmentedControl, Switch } from "./desmosComponents";
import { Component, jsx } from "#DCGView";

export default class SegmentedControl extends Component<{
  names: string[];
  selectedIndex: number;
  ariaGroupLabel: string;
  setSelectedIndex: (i: number) => void;
  allowChange?: boolean;
}> {
  template() {
    return (
      <Switch key={() => this.props.names().join(";")}>
        {() => (
          <DesmosSegmentedControl
            staticConfig={this.getStaticConfig()}
            ariaGroupLabel={this.props.ariaGroupLabel()}
            disabled={() => !this.getChangeAllowed(-1)}
          />
        )}
      </Switch>
    );
  }

  getStaticConfig() {
    return this.props.names().map((name, i) => ({
      key: name,
      label: () => name,
      selected: () => i === this.props.selectedIndex(),
      onSelect: () =>
        this.getChangeAllowed(i) && this.props.setSelectedIndex(i),
    }));
  }

  getChangeAllowed(i: number) {
    const { allowChange } = this.props;
    return (
      allowChange === undefined ||
      allowChange() === true ||
      i === this.props.selectedIndex()
    );
  }
}
