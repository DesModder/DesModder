import { PluginController } from "#plugins/PluginController.js";
import { ConfigItem } from "..";
import { ellipseGeneratorExpressions, ellipseLatex } from "./latex/ellipse";
import {
  rectangleGeneratorExpressions,
  rectangleLatex,
} from "./latex/rectangle";
import { DispatchedEvent } from "#globals";
import "./index.less";

interface NewDropdownItem {
  ariaLabel: string;
  label: string;
  okBtnExprId: string;
  handler: () => void;
  okBtnHandler: (expr: Desmos.ExpressionState) => void;
}

export default class ShapeGenerator extends PluginController<{
  showSliders: boolean;
}> {
  static id = "shape-generator" as const;
  static enabledByDefault = false;
  static config: readonly ConfigItem[] = [
    {
      type: "boolean",
      key: "showSliders",
      default: false,
    },
  ];

  private _isEditingShape = false;

  private readonly newDropdownItems: NewDropdownItem[] = [
    {
      ariaLabel: "Add ellipse",
      label: "ellipse",
      okBtnExprId: "shape-generator-ellipse",
      handler: () => {
        this.calc.setExpressions(ellipseGeneratorExpressions);
      },
      okBtnHandler: (expr) => {
        const xHelper = this.calc.HelperExpression({
          latex: "x_{ellipseGenerator}",
        });
        const yHelper = this.calc.HelperExpression({
          latex: "y_{ellipseGenerator}",
        });
        const rxHelper = this.calc.HelperExpression({
          latex: "r_{xEllipseGenerator}",
        });
        const ryHelper = this.calc.HelperExpression({
          latex: "r_{yEllipseGenerator}",
        });
        const angleHelper = this.calc.HelperExpression({
          latex: "A_{ellipseGenerator}",
        });

        // Wait for all helpers to have a numeric value
        angleHelper.observe("numericValue", () => {
          const x = xHelper.numericValue;
          const y = yHelper.numericValue;
          const rx = rxHelper.numericValue;
          const ry = ryHelper.numericValue;
          const angle = angleHelper.numericValue;

          if (isNaN(x) || isNaN(y) || isNaN(rx) || isNaN(ry) || isNaN(angle)) {
            return;
          }

          // TODO: HelperExpression is missing unobserve types
          angleHelper.unobserve("numericValue");

          // Create new empty expression to add the ellipse to
          this.calc.controller.dispatch({
            type: "new-expression",
          });

          // Generate ellipse LaTeX
          const latex = ellipseLatex(x, y, rx, ry, angle);

          // Set the expression
          this.calc.setExpression({
            ...expr,
            id: this.calc.selectedExpressionId,
            type: "expression",
            latex,
          });

          this.cleanupExpressions();
          this.isEditingShape = false;
        });
      },
    },
    {
      ariaLabel: "Add rectangle",
      label: "rectangle",
      okBtnExprId: "shape-generator-rectangle",
      handler: () => {
        this.calc.setExpressions(rectangleGeneratorExpressions);
      },
      okBtnHandler: (expr) => {
        const xHelper = this.calc.HelperExpression({
          latex: "x_{rectangleGenerator}",
        });
        const yHelper = this.calc.HelperExpression({
          latex: "y_{rectangleGenerator}",
        });
        const wHelper = this.calc.HelperExpression({
          latex: "w_{rectangleGenerator}",
        });
        const hHelper = this.calc.HelperExpression({
          latex: "h_{rectangleGenerator}",
        });
        const angleHelper = this.calc.HelperExpression({
          latex: "A_{rectangleGenerator}",
        });

        angleHelper.observe("numericValue", () => {
          const x = xHelper.numericValue;
          const y = yHelper.numericValue;
          const w = wHelper.numericValue;
          const h = hHelper.numericValue;
          const angle = angleHelper.numericValue;

          if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || isNaN(angle)) {
            return;
          }

          // TODO: HelperExpression is missing unobserve types
          angleHelper.unobserve("numericValue");

          // Create new empty expression to add the rectangle to
          this.calc.controller.dispatch({
            type: "new-expression",
          });

          // Generate rectangle LaTeX
          const latex = rectangleLatex(w, h, x, y, angle);

          // Set the expression
          this.calc.setExpression({
            ...expr,
            id: this.calc.selectedExpressionId,
            type: "expression",
            latex,
          });

          this.cleanupExpressions();
          this.isEditingShape = false;
        });
      },
    },
  ];

  private expressionsMutationObserver: MutationObserver | null = null;

  afterEnable() {
    // Listen for expression to add the OK button to
    this.expressionsMutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          const exprId = node.getAttribute("expr-id");
          const exprIdShapeGenerator = exprId?.match(
            /^shape-generator-(\w+)(?:-|$)/
          )?.[1];

          if (!exprIdShapeGenerator) {
            continue;
          }

          const newDropdownItem = this.newDropdownItems.find(
            (item) => item.label === exprIdShapeGenerator
          );

          if (!newDropdownItem) {
            continue;
          }

          const expressionTab = document.querySelector(
            `.dcg-expressionitem[expr-id=${JSON.stringify(
              newDropdownItem.okBtnExprId
            )}] .dcg-tab-interior`
          );

          if (!expressionTab) {
            continue;
          }

          if (expressionTab.querySelector(".shape-generator-ok-btn")) {
            continue;
          }

          const okButton = document.createElement("button");
          okButton.id = `shape-generator-${newDropdownItem.label}-ok-btn`;
          okButton.classList.add("shape-generator-ok-btn");
          okButton.textContent = "OK";
          okButton.addEventListener("click", () => {
            const expr = this.calc
              .getExpressions()
              .find((expr) => expr.id === newDropdownItem.okBtnExprId);

            if (!expr) {
              throw new Error(
                "Could not find the expression for the OK button"
              );
            }

            newDropdownItem.okBtnHandler(expr);
          });

          expressionTab.appendChild(okButton);
        }
      }
    });
    const expressionlist = document.querySelector(
      ".dcg-expressionitem[expr-id]"
    )?.parentElement;
    if (!expressionlist) {
      throw new Error("Could not find the expression list");
    }
    this.expressionsMutationObserver.observe(expressionlist, {
      childList: true,
    });

    this.afterConfigChange();
  }

  afterDisable() {
    // Remove global dataset attributes
    delete document.body.dataset.shapeGeneratorIsEditingShape;
    delete document.body.dataset.shapeGeneratorShowSliders;

    // Remove event listeners
    this.expressionsMutationObserver?.disconnect();
    this.expressionsMutationObserver = null;

    // Remove generated expressions
    this.cleanupExpressions();
  }

  afterConfigChange() {
    document.body.dataset.shapeGeneratorShowSliders =
      this.settings.showSliders.toString();
  }

  cleanupExpressions() {
    this.calc.removeExpressions(ellipseGeneratorExpressions);
    this.calc.removeExpressions(rectangleGeneratorExpressions);
  }

  get isEditingShape() {
    return this._isEditingShape;
  }

  set isEditingShape(value) {
    this._isEditingShape = value;

    document.body.dataset.shapeGeneratorIsEditingShape = value.toString();
  }

  addExpressionMenuHandler() {
    const addExpressionBtn = getAddExpressionButton();

    // Only add to popup if it's being opened
    if (addExpressionBtn.ariaExpanded === "false") {
      return;
    }

    const dropdown = document.querySelector<HTMLDivElement>(
      ".dcg-add-expression-dropdown div.dcg-popover-interior"
    );

    if (!dropdown) {
      throw new Error("Could not find the add expression dropdown");
    }

    const firstDropdownItem = dropdown.firstElementChild;
    if (!(firstDropdownItem instanceof HTMLDivElement)) {
      throw new Error("Dropdown does not have any children");
    }

    for (const newDropdownItem of this.newDropdownItems) {
      // Clone an existing dropdown item and modify it to add ellipse
      const newDropdownItemElm = firstDropdownItem.cloneNode(
        true
      ) as HTMLDivElement;

      newDropdownItemElm.classList.remove("dcg-action-newexpression");
      newDropdownItemElm.ariaLabel = newDropdownItem.ariaLabel;

      newDropdownItemElm.childNodes[1].textContent = newDropdownItem.label;

      dropdown.appendChild(newDropdownItemElm);

      if (this.isEditingShape) {
        newDropdownItemElm.ariaDisabled = "true";
        newDropdownItemElm.classList.add("dcg-disabled");
      } else {
        newDropdownItemElm.addEventListener("click", () => {
          // Close the dropdown
          addExpressionBtn.dispatchEvent(new CustomEvent("dcg-tap"));

          this.isEditingShape = true;

          // Run the handler for this dropdown item
          newDropdownItem.handler();
        });
      }
    }
  }

  handleDispatchedAction(e: DispatchedEvent) {
    if (e.type === "toggle-add-expression") {
      // Wait for addExpressionBtn.ariaExpanded to be updated
      queueMicrotask(() => {
        this.addExpressionMenuHandler();
      });
      return;
    }

    if (e.type !== "finish-deleting-item-after-animation") {
      return;
    }

    if (!e.id.startsWith("shape-generator-")) {
      return;
    }

    if (!this.isEditingShape) {
      throw new Error(
        "Shape generator expression deleted while not editing shape. This should not happen."
      );
    }

    const expressions = this.calc.getExpressions();

    for (const expression of expressions) {
      if (
        expression.id &&
        expression.id !== e.id &&
        expression.id.startsWith("shape-generator-")
      ) {
        this.calc.controller._finishDeletingItemAfterAnimation(
          expression.id,
          e.setFocusAfterDelete
        );
      }
    }

    this.isEditingShape = false;
  }
}

function getAddExpressionButton() {
  const btn = document.querySelector<HTMLButtonElement>(
    "button.dcg-add-expression-btn"
  );

  if (!btn) {
    throw new Error("Could not find the add expression button");
  }

  return btn;
}
