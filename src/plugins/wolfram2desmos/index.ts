import { MathQuillView } from "../../components/index.ts";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { wolfram2desmos, isLegalASCIIMath } from "./wolfram2desmos";

// This controller manages the focus events of Expression panel

export default class WolframToDesmos extends PluginController<Config> {
  static id = "wolfram2desmos" as const;
  static enabledByDefault = true;
  static config = configList;

  panel: HTMLElement | null = null;
  enabled = true;
  vanillaOverridePaste!: (e?: ClipboardEvent) => boolean;

  afterEnable() {
    this.vanillaOverridePaste = this.cc.clipboardHandlers.overridePaste;
    this.cc.clipboardHandlers.overridePaste = this.overridePaste;
  }

  afterDisable() {
    this.cc.clipboardHandlers.overridePaste = this.vanillaOverridePaste;
  }

  overridePaste = (e?: ClipboardEvent) => {
    const speciallyHandled = this.vanillaOverridePaste(e);
    if (speciallyHandled) return true;
    if (!e?.clipboardData) return false;

    const pasteData = e.clipboardData.getData("text/plain");
    if (
      pasteData === undefined ||
      pasteData === "" ||
      !isLegalASCIIMath(pasteData)
    ) {
      return false;
    }

    e.stopPropagation();
    e.preventDefault();
    const newLatex = wolfram2desmos(pasteData, this.settings);
    const mq = MathQuillView.getFocusedMathquill();
    if (!mq) return false;
    mq.write(newLatex);
    return true;
  };
}
