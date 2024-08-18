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
import { DispatchedEvent } from "#globals";
import { roundToDecimalPlaces } from "#utils/utils.js";

export default class ShapeGenerator extends PluginController<{
  showSliders: boolean;
  simplifyEquations: boolean;
  numericalPrecision: number;
}> {
  static id = "shape-generator" as const;
  static enabledByDefault = false;
  static config: readonly ConfigItem[] = [
    {
      type: "boolean",
      key: "showSliders",
      default: false,
    },
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

  private _isEditingShape = false;

  private _onDispatchHandler = "";

  ce = new ComputeEngine();

  afterEnable() {
    // Construct stylesheet
    const style = document.createElement("style");
    style.textContent = `
      /* Disable the save button while editing a shape */
      [data-shape-generator-is-editing-shape="true"] .save-btn-container .dcg-action-save {
        opacity: 0.5;
        pointer-events: none;
      }

      /* Disable pointer events on disabled Add expression dropdown items */
      .dcg-add-expression-dropdown div.dcg-popover-interior .dcg-new-item.dcg-disabled {
        pointer-events: none;
      }

      /* Hide shape points (controls) and helper functions expressions */
      .dcg-expressionitem[expr-id^="shape-generator-"][expr-id$="-point"],
      .dcg-expressionitem[expr-id^="shape-generator-"][expr-id*="-helper"] {
        display: none !important;
      }

      /* Hide sliders if the setting is disabled */
      [data-shape-generator-show-sliders="false"] .dcg-expressionitem[expr-id^="shape-generator-"]:has(.dcg-slider) {
        display: none !important;
      }

      .shape-generator-ok-btn {
        margin-top: 36px;
        margin-left: 1px;
      }
    `;
    style.id = "shape-generator-styles";
    document.head.appendChild(style);

    this._onDispatchHandler = this.calc.controller.dispatcher.register(
      this.onDispatch.bind(this)
    );

    this.afterConfigChange();
  }

  afterDisable() {
    // Remove stylesheet
    document.getElementById("shape-generator-styles")!.remove();

    // Remove global dataset attributes
    delete document.body.dataset.shapeGeneratorIsEditingShape;
    delete document.body.dataset.shapeGeneratorShowSliders;

    // Remove event listeners
    this.calc.controller.dispatcher.unregister(this._onDispatchHandler);

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

            if (
              isNaN(x) ||
              isNaN(y) ||
              isNaN(rx) ||
              isNaN(ry) ||
              isNaN(angle)
            ) {
              return;
            }

            // TODO: HelperExpression is missing unobserve types
            angleHelper.unobserve("numericValue");

            // Create new empty expression to add the ellipse to
            this.calc.controller.dispatch({
              type: "new-expression",
            });

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
            this.calc.controller.dispatch({
              type: "new-expression",
            });

            // Generate rectangle LaTeX
            let latex: string;
            if (this.settings.simplifyEquations) {
              const points = rectanglePoints(w, h, x, y, angle).map(
                ([px, py]) => {
                  const tuple = this.ce
                    .parse(rotatedPointLatex(px, py, x, y, angle))
                    .evaluate().json as ["Tuple", number, number];

                  return `\\left(${roundToDecimalPlaces(
                    tuple[1],
                    this.settings.numericalPrecision
                  )},${roundToDecimalPlaces(
                    tuple[2],
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

  onDispatch(e: DispatchedEvent) {
    if (e.type === "toggle-add-expression") {
      this.addExpressionMenuHandler();
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
