import { Component, DCGView, jsx } from "#DCGView";
import { InlineMathInputViewGeneral } from "#components";
import VideoCreator, { VcFocusedMq } from "..";
import { Calc } from "#globals";
import { EvaluateSingleExpression } from "#utils/depUtils.ts";
import "./ManagedNumberInput.less";

interface ManagedNumberInputParams {
  focusID: VcFocusedMq;
  ariaLabel: string;
  readonly?: boolean;
  hasError: (val: number) => boolean;
  vc: VideoCreator;
  data: ManagedNumberInputModel;
  numberUnits?: "rad" | "°" | "rad/s" | "°/s" | undefined;
  handlePressedKey?: (key: string, evt: KeyboardEvent) => void;
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

  getDefaultLatex() {
    return this.opts?.defaultLatex?.();
  }

  getLatex() {
    return this.#latex;
  }

  getLatexPopulatingDefault() {
    if (/^(\s|\\ )*$/.test(this.#latex)) {
      const def = this.getDefaultLatex();
      if (def !== undefined) return def;
    }
    return this.#latex;
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
        })}
        placeholder={() => this.props.data().getDefaultLatex() ?? ""}
        ariaLabel={() => this.props.ariaLabel()}
        handleLatexChanged={(latex) => {
          this.props.data().setLatexWithCallbacks(latex);
          // TODO-updateView: this should be a tick
          this.vc.updateView();
        }}
        latex={() => this.props.data().getLatex()}
        hasError={() => this.props.hasError(this.props.data().getValue())}
        manageFocus={DCGView.const(
          this.vc.getMathquillFocus(this.props.focusID())
        )}
        controller={this.vc.cc}
        readonly={() => this.props.readonly?.() ?? false}
        handlePressedKey={this.props.handlePressedKey}
      />
    );
  }
}
