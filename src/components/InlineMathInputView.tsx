import { Component, jsx } from "../DCGView";
import { Calc } from "../globals/window";
import { InlineMathInputViewGeneral } from "./desmosComponents";

/** InlineMathInputViewGeneral, but fills in defaults
 * readonly: false, controller: Calc.controller */
export default class InlineMathInputView extends Component<
  Omit<
    ConstructorParameters<typeof InlineMathInputViewGeneral>[0],
    "readonly" | "controller"
  >
> {
  template() {
    return (
      <InlineMathInputViewGeneral
        {...(this.props as any)}
        readonly={false}
        controller={Calc.controller}
      />
    );
  }
}
