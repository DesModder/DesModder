import { PluginController } from "../PluginController";

export default class ScrollBeyond extends PluginController {
  static id = "scroll-beyond" as const;
  static enabledByDefault = false;

  private dispatchHandler: string | undefined;

  afterEnable(): void {
    this.dispatchHandler = this.cc.dispatcher.register(() =>
      this.updateStyles()
    );
  }

  afterDisable(): void {
    if (this.dispatchHandler) {
      this.cc.dispatcher.unregister(this.dispatchHandler);
    }
  }

  private updateStyles() {
    const expPanel = document.querySelector<HTMLElement>(".dcg-exppanel");
    if (!expPanel) return;
    const expPanelHeight = expPanel.getBoundingClientRect().height;

    const branding = document.querySelector<HTMLElement>(
      ".dcg-expressions-branding"
    );
    if (!branding) return;
    const brandingHeight = branding.getBoundingClientRect().height;

    const newExpr = document.querySelector<HTMLElement>(".dcg-new-expression");
    if (!newExpr) return;
    const newExprHeight = newExpr.getBoundingClientRect().height;

    const newExpression = document.querySelector<HTMLElement>(
      ".dcg-new-expression"
    );
    if (!newExpression) return;

    const height = expPanelHeight - brandingHeight - newExprHeight;
    const p = `${height.toFixed(0)}px`;
    if (p !== newExpression.style.marginBottom) {
      newExpression.style.marginBottom = p;
    }
  }
}
