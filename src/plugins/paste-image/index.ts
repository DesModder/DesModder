import { PluginController } from "../PluginController";

export default class PasteImage extends PluginController {
  static id = "paste-image" as const;
  static enabledByDefault = true;

  pasteHandler = this._pasteHandler.bind(this);

  afterEnable() {
    document.addEventListener("paste", this.pasteHandler);
  }

  afterDisable() {
    document.removeEventListener("paste", this.pasteHandler);
  }

  _pasteHandler(e: ClipboardEvent) {
    if (!this.calc.selectedExpressionId) {
      // avoid images being inserted at the top of the expressions list
      // when there is no selected expression
      if (document.activeElement !== document.body) return;
      const lastExpression: Desmos.ExpressionState = this.calc
        .getExpressions()
        .splice(-1)[0];
      this.cc.dispatch({
        type: "set-focus-location",
        location: {
          type: "expression",
          id: lastExpression.id,
        },
      });
    }
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles?.length) {
      e.preventDefault();
      this.cc.dispatch({
        type: "new-images",
        files: clipboardFiles,
      });
    }
  }
}
