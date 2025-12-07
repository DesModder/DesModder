import { Config, configList } from "./config";
import "./custom-mathquill-config.less";
import { MathQuillConfig } from "#components";
import { DWindow } from "#globals";
import { PluginController } from "#plugins/PluginController.ts";

const defaultConfig: MathQuillConfig = {
  charsThatBreakOutOfSupSub: "+-=<>*",
  disableAutoSubstitutionInSubscripts: true,
  autoSubscriptNumerals: true,
  sumStartsWithNEquals: true,
  leftRightIntoCmdGoes: "up",
  supSubsRequireOperand: true,
  restrictMismatchedBrackets: true,
  typingPercentWritesPercentOf: true,
};

export default class CustomMathQuillConfig extends PluginController<Config> {
  static id = "custom-mathquill-config" as const;
  static enabledByDefault = false;
  static config = configList;

  oldConfig = this.cc.getMathquillConfig;
  doAutoCommandInjections = false;
  autoCommandInjections =
    " gamma Gamma delta Delta epsilon zeta eta Theta iota kappa lambda Lambda mu Xi xi Pi sigma Sigma upsilon Upsilon Phi chi psi Psi omega Omega";

  updateConfig(config: Config) {
    this.cc.rootElt.classList.toggle("commaizer", config.commaDelimiter);

    this.cc.rootElt.classList.toggle("less-f-spacing", config.lessFSpacing);

    this.doAutoCommandInjections = config.extendedGreek;

    this.cc.rootElt.style.setProperty(
      "--delimiter-override",
      `"${CSS.escape(config.delimiterOverride)}"`
    );

    const settingsObj = {
      charsThatBreakOutOfSupSub: config.superscriptOperators
        ? "=<>"
        : defaultConfig.charsThatBreakOutOfSupSub,
      disableAutoSubstitutionInSubscripts: config.subscriptReplacements
        ? false
        : defaultConfig.disableAutoSubstitutionInSubscripts,
      autoSubscriptNumerals: config.noAutoSubscript
        ? false
        : defaultConfig.autoSubscriptNumerals,
      sumStartsWithNEquals: config.noNEquals
        ? false
        : defaultConfig.sumStartsWithNEquals,
      leftRightIntoCmdGoes: config.leftIntoSubscript
        ? "down"
        : defaultConfig.leftRightIntoCmdGoes,
      supSubsRequireOperand: config.subSupWithoutOp
        ? false
        : defaultConfig.supSubsRequireOperand,
      restrictMismatchedBrackets: config.allowMixedBrackets
        ? false
        : defaultConfig.restrictMismatchedBrackets,
      typingPercentWritesPercentOf: config.noPercentOf
        ? false
        : defaultConfig.typingPercentWritesPercentOf,
    };
    (window as any as DWindow).Desmos.MathQuill.config(settingsObj);
  }

  afterEnable() {
    this.cc.getMathquillConfig = (e) => {
      const currentConfig = this.oldConfig.call(this.cc, e);
      if (this.doAutoCommandInjections) {
        currentConfig.autoCommands += this.autoCommandInjections;
      }
      return currentConfig;
    };
    this.updateConfig(this.settings);
  }

  afterDisable() {
    this.doAutoCommandInjections = false;
    this.cc.rootElt.classList.remove("commaizer");
    (window as any as DWindow).Desmos.MathQuill.config(defaultConfig);
    this.cc.getMathquillConfig = this.oldConfig;
  }

  afterConfigChange() {
    this.updateConfig(this.settings);
  }
}
