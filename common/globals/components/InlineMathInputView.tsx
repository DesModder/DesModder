import { Component, jsx } from "#DCGView";
import { InlineMathInputViewGeneral } from "./desmosComponents";

/** InlineMathInputViewGeneral, but fills in default readonly: false */
export default class InlineMathInputView extends Component<
  Omit<ConstructorParameters<typeof InlineMathInputViewGeneral>[0], "readonly">
> {
  template() {
    return (
      <InlineMathInputViewGeneral {...(this.props as any)} readonly={false} />
    );
  }
}
