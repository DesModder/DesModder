import { Component, jsx } from "#DCGView";
import { InlineMathInputViewGeneral } from "#components";
import VideoCreator from "..";
import { Calc } from "#globals";
import { EvaluateSingleExpression } from "#utils/depUtils.ts";

interface ManagedNumberInputParams {
  focusID: string;
  ariaLabel: string;
  readonly?: boolean;
  hasError: (val: number) => boolean;
  vc: VideoCreator;
  data: ManagedNumberInputModel;
}

export interface ManagedNumberInputModelOpts {
  afterLatexChanged?: () => void;
  fixedDecimals?: () => number;
}

export class ManagedNumberInputModel {
  #latex: string;

  constructor(
    latex: string,
    private readonly calc: Calc,
    private readonly opts?: ManagedNumberInputModelOpts
  ) {
    this.#latex = latex;
  }

  set latex(latex: string) {
    this.#latex = latex;
    this.opts?.afterLatexChanged?.();
  }

  get latex() {
    return this.#latex;
  }

  setValue(v: number) {
    this.latex = v.toFixed(this.opts?.fixedDecimals?.() ?? 0);
  }

  getValue() {
    return EvaluateSingleExpression(this.calc, this.latex);
  }
}

export default class ManagedNumberInput extends Component<ManagedNumberInputParams> {
  vc!: VideoCreator;

  init() {
    this.vc = this.props.vc();
  }

  template() {
    return (
      <InlineMathInputViewGeneral
        ariaLabel={() => this.props.ariaLabel()}
        handleLatexChanged={(latex) => {
          this.props.data().latex = latex;
          // TODO-updateView: this should be a tick
          this.vc.updateView();
        }}
        latex={() => this.props.data().latex}
        hasError={() => this.props.hasError(this.props.data().getValue())}
        handleFocusChanged={(b) => this.vc.updateFocus(this.props.focusID(), b)}
        isFocused={() => this.vc.isFocused(this.props.focusID())}
        controller={this.vc.cc}
        readonly={() => this.props.readonly?.() ?? false}
      />
    );
  }
}
