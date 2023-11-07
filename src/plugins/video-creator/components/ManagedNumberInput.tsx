import { Component, jsx } from "#DCGView";
import { InlineMathInputViewGeneral } from "#components";
import VideoCreator from "..";
import { Calc } from "#globals";
import { EvaluateSingleExpression } from "#utils/depUtils.ts";
import "./ManagedNumberInput.less";

interface ManagedNumberInputParams {
  focusID: string;
  ariaLabel: string;
  readonly?: boolean;
  hasError: (val: number) => boolean;
  vc: VideoCreator;
  data: ManagedNumberInputModel;
  numberUnits?: "rad" | "°" | "rad/s" | "°/s" | undefined;
}

export interface ManagedNumberInputModelOpts {
  afterLatexChanged?: () => void;
  defaultLatex?: () => string;
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

  setLatexWithoutCallbacks(latex: string) {
    this.#latex = latex;
  }

  setLatexWithCallbacks(latex: string) {
    this.setLatexWithoutCallbacks(latex);
    this.opts?.afterLatexChanged?.();
  }

  getLatexPopulatingDefault() {
    if (this.isPopulatedByDefault())
      return this.opts?.defaultLatex?.() ?? this.#latex;
    return this.#latex;
  }

  isPopulatedByDefault() {
    return /^(\s|\\ )*$/.test(this.#latex) && !!this.opts?.defaultLatex;
  }

  getValue() {
    return EvaluateSingleExpression(
      this.calc,
      this.getLatexPopulatingDefault()
    );
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
        containerClass={() => ({
          "dcg-suffix-degree": this.props.numberUnits?.() === "°",
          "dcg-suffix-radian": this.props.numberUnits?.() === "rad",
          "dsm-suffix-degree-per-sec": this.props.numberUnits?.() === "°/s",
          "dsm-suffix-radian-per-sec": this.props.numberUnits?.() === "rad/s",
          "dsm-input-placeholder": this.props.data().isPopulatedByDefault(),
        })}
        ariaLabel={() => this.props.ariaLabel()}
        handleLatexChanged={(latex) => {
          this.props.data().setLatexWithCallbacks(latex);
          // TODO-updateView: this should be a tick
          this.vc.updateView();
        }}
        latex={() => this.props.data().getLatexPopulatingDefault()}
        hasError={() => this.props.hasError(this.props.data().getValue())}
        handleFocusChanged={(b) => {
          this.vc.updateFocus(this.props.focusID(), b);
          if (b) {
            const d = this.props.data();
            // Overwrite fixed latex with placeholder latex.
            d.setLatexWithCallbacks(d.getLatexPopulatingDefault());
            // TODO-updateView: this should be a tick
            this.vc.updateView();
          }
        }}
        isFocused={() => this.vc.isFocused(this.props.focusID())}
        controller={this.vc.cc}
        readonly={() => this.props.readonly?.() ?? false}
      />
    );
  }
}
