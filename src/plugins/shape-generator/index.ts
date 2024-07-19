import { PluginController } from "#plugins/PluginController.js";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { computeEngineLatexToDesmosLatex } from "compute-engine-to-desmos-latex";
import { ConfigItem } from "..";
import { ellipseGeneratorExpressions, ellipseLatex } from "./latex/ellipse";

export default class ShapeGenerator extends PluginController<{
  simplifyEquations: boolean;
}> {
  static id = "shape-generator" as const;
  static enabledByDefault = false;
  static config: readonly ConfigItem[] = [
    {
      type: "boolean",
      key: "simplifyEquations",
      default: true,
    },
  ];

  private _addExpressionBtnClickHandler: (() => void) | null = null;
  isEditingShape = false;

  ce = new ComputeEngine();

  afterEnable() {
    const addExpressionBtn = getAddExpressionButton();
    this._addExpressionBtnClickHandler =
      addExpressionBtnClickHandler.bind(this);
    addExpressionBtn.addEventListener(
      "click",
      this._addExpressionBtnClickHandler
    );

    // Construct stylesheet
    const style = document.createElement("style");
    const expressionIdsToHide = [
      "shape-generator-ellipse-position-point",
      "shape-generator-ellipse-radius-x-point",
      "shape-generator-ellipse-radius-y-point",
      "shape-generator-ellipse-radius-y-point-helper",
      "shape-generator-ellipse-angle-point-helper-x",
      "shape-generator-ellipse-angle-point-helper-y",
      "shape-generator-ellipse-angle-point",
    ];
    let styleCss = "";
    for (const exprId of expressionIdsToHide) {
      styleCss += `.dcg-expressionitem[expr-id=${JSON.stringify(exprId)}],`;
    }
    styleCss = styleCss.slice(0, -1); // Remove trailing comma
    styleCss += `{ display: none !important; }`;
    styleCss += `
      #shape-generator-ellipse-ok-btn {
        margin-top: 36px;
        margin-left: 1px;
      }
    `;
    style.textContent = styleCss;
    style.id = "shape-generator-styles";
    document.head.appendChild(style);
  }

  afterDisable() {
    // Prevent the Add ellipse button from being added to the Add expression dropdown
    const addExpressionBtn = getAddExpressionButton();
    addExpressionBtn.removeEventListener(
      "click",
      this._addExpressionBtnClickHandler!
    );

    // Remove stylesheet
    document.getElementById("shape-generator-styles")!.remove();

    // Remove generated expressions
    this.cleanupExpressions();
  }

  cleanupExpressions() {
    this.calc.removeExpressions([
      {
        id: "shape-generator-ellipse",
      },
      {
        id: "shape-generator-ellipse-position-point",
      },
      {
        id: "shape-generator-ellipse-position-x",
      },
      {
        id: "shape-generator-ellipse-position-y",
      },
      {
        id: "shape-generator-ellipse-radius-x",
      },
      {
        id: "shape-generator-ellipse-radius-x-point",
      },
      {
        id: "shape-generator-ellipse-radius-y",
      },
      {
        id: "shape-generator-ellipse-radius-y-point-helper",
      },
      {
        id: "shape-generator-ellipse-radius-y-point",
      },
      {
        id: "shape-generator-ellipse-angle",
      },
      {
        id: "shape-generator-ellipse-angle-point-helper-x",
      },
      {
        id: "shape-generator-ellipse-angle-point-helper-y",
      },
      {
        id: "shape-generator-ellipse-angle-point",
      },
    ]);
  }
}

function addExpressionBtnClickHandler(this: ShapeGenerator) {
  const addExpressionBtn = getAddExpressionButton();

  // Only add to popup if it's being opened
  if (addExpressionBtn.ariaExpanded === "false") {
    return;
  }

  const dropdown = getAddExpressionDropdown();

  const newDropdownItems: {
    ariaLabel: string;
    label: string;
    disabled?: boolean;
    handler: () => void;
  }[] = [
    {
      ariaLabel: "Add ellipse",
      label: "ellipse",
      disabled: this.isEditingShape,
      handler: () => {
        this.isEditingShape = true;

        this.calc.observeEvent("change.shapeGenerator", () => {
          const ellipseExpressionTab = document.querySelector(
            '.dcg-expressionitem[expr-id="shape-generator-ellipse"] .dcg-tab-interior'
          );

          if (!ellipseExpressionTab) {
            return;
          }

          const okButton = document.createElement("button");
          okButton.id = "shape-generator-ellipse-ok-btn";
          okButton.textContent = "OK";
          okButton.addEventListener("click", () => {
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

            angleHelper.observe("numericValue", () => {
              const x = xHelper.numericValue;
              const y = yHelper.numericValue;
              const rx = rxHelper.numericValue;
              const ry = ryHelper.numericValue;
              const angle = angleHelper.numericValue;

              if (
                isNaN(x) ||
                isNaN(y) ||
                isNaN(rx) ||
                isNaN(ry) ||
                isNaN(angle)
              ) {
                return;
              }

              // TODO: HelperExpression missing unobserve types
              angleHelper.unobserve("numericValue");

              // Create new empty expression to add the ellipse to
              firstDropdownItem!.dispatchEvent(new CustomEvent("dcg-tap"));

              // Generate ellipse LaTeX
              let latex = ellipseLatex(x, y, rx, ry, angle);

              // Simplify the equation if needed
              if (this.settings.simplifyEquations) {
                latex = computeEngineLatexToDesmosLatex(
                  this.ce.parse(latex).evaluate().latex
                );
              }

              // Set the expression
              this.calc.setExpression({
                id: this.calc.selectedExpressionId,
                latex,
              });

              this.cleanupExpressions();
              this.isEditingShape = false;
            });
          });

          ellipseExpressionTab.appendChild(okButton);

          this.calc.unobserveEvent("change.shapeGenerator");
        });

        this.calc.setExpressions(ellipseGeneratorExpressions);
      },
    },
  ];

  const firstDropdownItem = dropdown.firstElementChild;
  if (!(firstDropdownItem instanceof HTMLDivElement)) {
    throw new Error("Dropdown does not have any children");
  }

  for (const newDropdownItem of newDropdownItems) {
    // Clone an existing dropdown item and modify it to add ellipse
    const newDropdownItemElm = firstDropdownItem.cloneNode(
      true
    ) as HTMLDivElement;

    newDropdownItemElm.classList.remove("dcg-action-newexpression");
    newDropdownItemElm.ariaLabel = newDropdownItem.ariaLabel;

    newDropdownItemElm.childNodes[1].textContent = newDropdownItem.label;

    dropdown.appendChild(newDropdownItemElm);

    if (newDropdownItem.disabled) {
      newDropdownItemElm.ariaDisabled = "true";
      newDropdownItemElm.classList.add("dcg-disabled");
    } else {
      newDropdownItemElm.addEventListener("click", () => {
        // Close the dropdown
        addExpressionBtn.dispatchEvent(new CustomEvent("dcg-tap"));

        // Run the handler for this dropdown item
        newDropdownItem.handler();
      });
    }
  }
}

function getAddExpressionButton() {
  const btn = document.querySelector("button.dcg-add-expression-btn");

  if (!btn) {
    throw new Error("Could not find the add expression button");
  }

  return btn as HTMLButtonElement;
}

function getAddExpressionDropdown() {
  const dropdown = document.querySelector(
    ".dcg-add-expression-dropdown div.dcg-popover-interior"
  );

  if (!dropdown) {
    throw new Error("Could not find the add expression dropdown");
  }

  return dropdown as HTMLDivElement;
}
