/* eslint-disable @typescript-eslint/no-dynamic-delete */
import { Config, configList } from "./config";
import "./custom-mathquill-config.less";
import { MathQuillConfig, MathQuillField } from "#components";
import { Calc, DWindow } from "#globals";
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

  oldConfig = Calc.controller.getMathquillConfig;
  doAutoCommandInjections = false;
  autoCommandInjections =
    " gamma Gamma delta Delta epsilon zeta eta Theta iota kappa lambda Lambda mu Xi xi Pi rho sigma Sigma upsilon Upsilon Phi chi psi Psi omega Omega";

  updateConfig(config: Config) {
    Calc.controller.rootElt.classList.toggle(
      "commaizer",
      config.commaDelimiter
    );

    Calc.controller.rootElt.classList.toggle(
      "less-f-spacing",
      config.lessFSpacing
    );

    this.doAutoCommandInjections = config.extendedGreek;

    Calc.controller.rootElt.style.setProperty(
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
    this.updateAllMathquill();
  }

  afterEnable() {
    Calc.controller.getMathquillConfig = (e) => {
      const currentConfig = this.oldConfig.call(Calc.controller, e);
      if (this.doAutoCommandInjections) {
        currentConfig.autoCommands += this.autoCommandInjections;
      }
      return currentConfig;
    };
    this.updateConfig(this.settings);
    this.updateAllMathquill();
  }

  afterDisable() {
    this.doAutoCommandInjections = false;
    Calc.controller.rootElt.classList.remove("commaizer");
    (window as any as DWindow).Desmos.MathQuill.config(defaultConfig);
    Calc.controller.getMathquillConfig = this.oldConfig;
    this.updateAllMathquill();
  }

  afterConfigChange() {
    this.updateConfig(this.settings);
  }

  updateAllMathquill() {
    for (const mqField of document.querySelectorAll(".dcg-math-field")) {
      if (mqField.classList.contains("dcg-static-mathquill-view")) continue;

      const currentMQ = (
        mqField as Element & { _mqMathFieldInstance: MathQuillField }
      )._mqMathFieldInstance;
      const injectionList = this.autoCommandInjections.substring(1).split(" ");
      if (this.doAutoCommandInjections) {
        for (const injection of injectionList) {
          currentMQ.__options.autoCommands[injection] = 1;
        }
      } else {
        for (const injection of injectionList) {
          delete currentMQ.__options.autoCommands[injection];
        }
      }
    }
  }
}
