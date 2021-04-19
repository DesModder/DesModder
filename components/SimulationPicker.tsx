import { DCGView, For, StaticMathQuillView } from "desmodder";
import Controller from "../Controller";
import "./SimulationPicker.css";

interface Rule {
  id: string;
  assignment: string;
  expression: string;
}

export default class SimulationPicker extends DCGView.Class<{
  controller: Controller;
}> {
  template() {
    return (
      <For
        each={() => this.getRules()}
        key={(rule) =>
          this.props.controller().currentSimulationID + "," + rule.id
        }
      >
        <div class="video-creator-simulation-rules">
          {(rule: Rule) => (
            <div class="dcg-clickable-property-row">
              Set
              <StaticMathQuillView latex={() => rule.assignment} />
              to
              <StaticMathQuillView latex={() => rule.expression} />
            </div>
          )}
        </div>
      </For>
    );
  }

  getRules() {
    const currentSimulation = this.props.controller().getCurrentSimulation();
    if (currentSimulation !== undefined) {
      return currentSimulation.clickableInfo.rules;
    } else {
      return [];
    }
  }
}
