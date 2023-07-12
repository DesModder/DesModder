import { Config, configList } from "./config";
import "./custom-mathquill-config.less";
import { MathQuillField } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";

const defaultConfig: Desmos.MathQuillConfig = {
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

  oldConfig = Calc.controller.getMathquillConfig;
  doAutoCommandInjections = false;
  autoCommandInjections =
    " gamma Gamma delta Delta epsilon zeta eta Theta iota kappa lambda Lambda mu nu Xi xi Pi rho sigma Sigma upsilon Upsilon Phi chi psi Psi omega Omega";

  updateConfig(config: Config) {
    if (config.commaDelimeter) {
      Calc.controller.rootElt.classList.add("commaizer");
    } else {
      Calc.controller.rootElt.classList.remove("commaizer");
    }

    this.doAutoCommandInjections = config.extendedGreek;

    document.documentElement.style.setProperty(
      "--delimeter-override",
      `\"${CSS.escape(config.delimeterOverride)}\"`
    );

    let settingsObj: Desmos.MathQuillConfig = {
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
    Desmos.MathQuill.config(settingsObj);
    this.updateAllMathquill();
  }

  afterEnable() {
    Calc.controller.getMathquillConfig = (e: {
      additionalOperators?: string[];
    }) => {
      let config = this.oldConfig.call(Calc.controller, e);
      if (this.doAutoCommandInjections) {
        config.autoCommands += this.autoCommandInjections;
      }
      return config;
    };
    this.updateConfig(this.settings);
    this.updateAllMathquill();
  }

  afterDisable() {
    this.doAutoCommandInjections = false;
    Calc.controller.rootElt.classList.remove("commaizer");
    Desmos.MathQuill.config(defaultConfig);
    Calc.controller.getMathquillConfig = this.oldConfig;
    this.updateAllMathquill();
  }

  afterConfigChange() {
    this.updateConfig(this.settings);
  }

  updateAllMathquill() {
    for (let mqField of document.querySelectorAll(
      ".dcg-math-field"
    ) as NodeListOf<Element & { _mqMathFieldInstance: MathQuillField }>) {
      let currentMQ = mqField._mqMathFieldInstance;
      let injectionList = this.autoCommandInjections.substring(1).split(" ");
      if (this.doAutoCommandInjections) {
        for (let injection of injectionList) {
          currentMQ.__options.autoCommands[injection] = 1;
        }
      } else {
        for (let injection of injectionList) {
          delete currentMQ.__options.autoCommands[injection];
        }
      }
    }
  }
}
