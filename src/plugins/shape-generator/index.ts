import { PluginController } from "#plugins/PluginController.js";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { computeEngineLatexToDesmosLatex } from "compute-engine-to-desmos-latex";
import { ConfigItem } from "..";
import { ellipseGeneratorExpressions, ellipseLatex } from "./latex/ellipse";
import {
  rectangleGeneratorExpressions,
  rectangleLatex,
  rectangleLatexGivenPointsLatex,
  rectanglePoints,
} from "./latex/rectangle";
import { rotatedPointLatex } from "./latex";

export default class ShapeGenerator extends PluginController<{
  simplifyEquations: boolean;
  numericalPrecision: number;
}> {
  static id = "shape-generator" as const;
  static enabledByDefault = false;
  static config: readonly ConfigItem[] = [
    {
      type: "boolean",
      key: "simplifyEquations",
      default: true,
    },
    {
      type: "number",
      key: "numericalPrecision",
      default: 3,
      min: 0,
      max: 20,
      step: 1,
    },
  ];

  private _addExpressionBtnClickHandler: (() => void) | null = null;
  private _isEditingShape = false;

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
    style.textContent = `
      .dcg-expressionitem[expr-id^="shape-generator-"][expr-id$="-point"],
      .dcg-expressionitem[expr-id^="shape-generator-"][expr-id*="-helper"]{
        display: none !important;
      }

      .shape-generator-ok-btn {
        margin-top: 36px;
        margin-left: 1px;
      }
    `;
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

    // Re-enable the save button if it was disabled.
    // We only remove dcg-disabled if shape-generator-disabled is present.
    // This is to prevent re-enabling the save button if it was disabled,
    // by Desmos or another plugin, for another reason.
    const saveBtn = getSaveBtn();
    if (saveBtn?.classList.contains("shape-generator-disabled")) {
      saveBtn.classList.remove("dcg-disabled", "shape-generator-disabled");
    }
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

    // Disable the save button if the user is editing a shape
    const saveBtn = getSaveBtn();
    if (saveBtn) {
      saveBtn.classList.toggle("dcg-disabled", value);
      saveBtn.classList.toggle("shape-generator-disabled", value);
    }
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
    okBtnExprId: string;
    handler: () => void;
    okBtnHandler: () => void;
  }[] = [
    {
      ariaLabel: "Add ellipse",
      label: "ellipse",
      okBtnExprId: "shape-generator-ellipse",
      handler: () => {
        this.calc.setExpressions(ellipseGeneratorExpressions);
      },
      okBtnHandler: () => {
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

          if (isNaN(x) || isNaN(y) || isNaN(rx) || isNaN(ry) || isNaN(angle)) {
            return;
          }

          // TODO: HelperExpression is missing unobserve types
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
      },
    },
    {
      ariaLabel: "Add rectangle",
      label: "rectangle",
      okBtnExprId: "shape-generator-rectangle",
      handler: () => {
        this.calc.setExpressions(rectangleGeneratorExpressions);
      },
      okBtnHandler: () => {
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
          firstDropdownItem!.dispatchEvent(new CustomEvent("dcg-tap"));

          // Generate rectangle LaTeX
          let latex: string;
          if (this.settings.simplifyEquations) {
            const points = rectanglePoints(w, h, x, y, angle).map(
              ([px, py]) => {
                const tuple = this.ce
                  .parse(rotatedPointLatex(px, py, x, y, angle))
                  .evaluate().json as ["Tuple", number, number];

                return `\\left(${tuple[1].toFixed(
                  this.settings.numericalPrecision
                )},${tuple[2].toFixed(
                  this.settings.numericalPrecision
                )}\\right)`;
              }
            );

            latex = rectangleLatexGivenPointsLatex(points.join(","));
          } else {
            latex = rectangleLatex(w, h, x, y, angle);
          }

          // Set the expression
          this.calc.setExpression({
            id: this.calc.selectedExpressionId,
            latex,
          });

          this.cleanupExpressions();
          this.isEditingShape = false;
        });
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

    if (this.isEditingShape) {
      newDropdownItemElm.ariaDisabled = "true";
      newDropdownItemElm.classList.add("dcg-disabled");
    } else {
      newDropdownItemElm.addEventListener("click", () => {
        // Close the dropdown
        addExpressionBtn.dispatchEvent(new CustomEvent("dcg-tap"));

        this.isEditingShape = true;

        // Listen for expression to add the OK button to
        const eventId = `change.shapeGenerator.${newDropdownItem.label}`;
        this.calc.observeEvent(eventId, () => {
          const expressionTab = document.querySelector(
            `.dcg-expressionitem[expr-id=${JSON.stringify(
              newDropdownItem.okBtnExprId
            )}] .dcg-tab-interior`
          );

          if (!expressionTab) {
            return;
          }

          const okButton = document.createElement("button");
          okButton.id = `shape-generator-${newDropdownItem.label}-ok-btn`;
          okButton.classList.add("shape-generator-ok-btn");
          okButton.textContent = "OK";
          okButton.addEventListener("click", newDropdownItem.okBtnHandler);

          expressionTab.appendChild(okButton);

          this.calc.unobserveEvent(eventId);
        });

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

function getSaveBtn() {
  return document.querySelector(".save-btn-container .dcg-action-save");
}
