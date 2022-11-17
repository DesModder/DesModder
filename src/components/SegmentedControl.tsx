import "./SegmentedControl.less";
import { Component, jsx } from "DCGView";
import { mergeClass, MaybeClassDict } from "utils/utils";

export default class SegmentedControl extends Component<{
  names: string[];
  selectedIndex: number;
  setSelectedIndex(i: number): void;
  class?: MaybeClassDict;
  allowChange?: boolean;
}> {
  template() {
    return (
      <div
        class={() =>
          mergeClass(
            "dcg-segmented-control-container",
            this.props.class && this.props.class()
          )
        }
        role="group"
      >
        {this.props.names().map((name, i) => (
          <div
            key={i}
            class={() => ({
              "dcg-segmented-control-btn": true,
              "dcg-dark-gray-segmented-control-btn": true,
              "dcg-selected dcg-active": i === this.props.selectedIndex(),
              "dsm-disallow-change": !this.getChangeAllowed(i),
            })}
            role="button"
            ariaLabel={name}
            onTap={() =>
              this.getChangeAllowed(i) && this.props.setSelectedIndex(i)
            }
          >
            {name}
          </div>
        ))}
      </div>
    );
  }

  getChangeAllowed(i: number) {
    const allowChange = this.props.allowChange;
    return (
      allowChange === undefined ||
      allowChange() ||
      i === this.props.selectedIndex()
    );
  }
}
