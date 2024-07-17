import { PluginController } from "#plugins/PluginController.js";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { computeEngineLatexToDesmosLatex } from "compute-engine-to-desmos-latex";

export default class ShapeGenerator extends PluginController {
  static id = "shape-generator" as const;
  static enabledByDefault = false;

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
    const addExpressionBtn = getAddExpressionButton();
    addExpressionBtn.removeEventListener(
      "click",
      this._addExpressionBtnClickHandler!
    );

    document.getElementById("shape-generator-styles")!.remove();

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
        // Close the dropdown
        addExpressionBtn.dispatchEvent(new CustomEvent("dcg-tap"));

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

              firstDropdownItem!.dispatchEvent(new CustomEvent("dcg-tap"));
              this.calc.setExpression({
                id: this.calc.selectedExpressionId,
                latex: computeEngineLatexToDesmosLatex(
                  this.ce.parse(ellipseLatex(x, y, rx, ry, angle)).evaluate()
                    .latex
                ),
              });

              this.cleanupExpressions();
              this.isEditingShape = false;
            });
          });

          ellipseExpressionTab.appendChild(okButton);

          this.calc.unobserveEvent("change.shapeGenerator");
        });

        this.calc.setExpressions([
          {
            id: "shape-generator-ellipse",
            type: "expression",
            latex: ellipseLatex(
              "x_{ellipseGenerator}",
              "y_{ellipseGenerator}",
              "r_{xEllipseGenerator}",
              "r_{yEllipseGenerator}",
              "A_{ellipseGenerator}"
            ),
            color: "",
          },
          {
            id: "shape-generator-ellipse-position-point",
            type: "expression",
            latex: "\\left(x_{ellipseGenerator},y_{ellipseGenerator}\\right)",
            color: "",
          },
          {
            id: "shape-generator-ellipse-position-x",
            type: "expression",
            latex: "x_{ellipseGenerator}=0",
            color: "",
          },
          {
            id: "shape-generator-ellipse-position-y",
            type: "expression",
            latex: "y_{ellipseGenerator}=0",
            color: "",
          },
          {
            id: "shape-generator-ellipse-radius-x",
            type: "expression",
            latex: "r_{xEllipseGenerator}=1",
            sliderBounds: { min: 0, max: "", step: "" },
            color: "",
          },
          {
            id: "shape-generator-ellipse-radius-x-point",
            type: "expression",
            latex: `\\left(x_{ellipseGenerator}-r_{xEllipseGenerator}\\cos A_{ellipseGenerator},y_{ellipseGenerator}-r_{xEllipseGenerator}\\sin A_{ellipseGenerator}\\right)`,
            color: "",
          },
          {
            id: "shape-generator-ellipse-radius-y",
            type: "expression",
            latex: "r_{yEllipseGenerator}=1",
            sliderBounds: { min: 0, max: "", step: "" },
            color: "",
          },
          {
            id: "shape-generator-ellipse-radius-y-point-helper",
            type: "expression",
            latex:
              "f_{ellipseGeneratorRadiusYX}\\left(R_{yEllipseGenerator}\\right)=x_{ellipseGenerator}+R_{yEllipseGenerator}\\cos\\left(A_{ellipseGenerator}+\\frac{\\pi}{2}\\right)",
            hidden: true,
            color: "",
          },
          {
            id: "shape-generator-ellipse-radius-y-point",
            type: "expression",
            latex: `\\left(f_{ellipseGeneratorRadiusYX}\\left(r_{yEllipseGenerator}\\right),y_{ellipseGenerator}+r_{yEllipseGenerator}\\sin\\left(A_{ellipseGenerator}+\\frac{\\pi}{2}\\right)\\right)`,
            color: "",
          },
          {
            id: "shape-generator-ellipse-angle",
            type: "expression",
            latex: "A_{ellipseGenerator}=0",
            sliderBounds: { min: 0, max: "\\tau", step: "" },
            color: "",
          },
          {
            id: "shape-generator-ellipse-angle-point-helper-x",
            type: "expression",
            latex:
              "f_{ellipseGeneratorAngleX}\\left(a_{ellipseGenerator}\\right)=x_{ellipseGenerator}+r_{xEllipseGenerator}\\cos a_{ellipseGenerator}",
            hidden: true,
            color: "",
          },
          {
            id: "shape-generator-ellipse-angle-point-helper-y",
            type: "expression",
            latex:
              "f_{ellipseGeneratorAngleY}\\left(a_{ellipseGenerator}\\right)=y_{ellipseGenerator}+r_{xEllipseGenerator}\\sin a_{ellipseGenerator}",
            hidden: true,
            color: "",
          },
          {
            id: "shape-generator-ellipse-angle-point",
            type: "expression",
            latex:
              "\\left(f_{ellipseGeneratorAngleX}\\left(A_{ellipseGenerator}\\right),f_{ellipseGeneratorAngleY}\\left(A_{ellipseGenerator}\\right)\\right)",
            dragMode: "X",
            color: "",
          },
        ]);
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
      newDropdownItemElm.addEventListener("click", newDropdownItem.handler);
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

// From
// https://github.com/lafkpages/desmos-experiments/blob/734279478aaf8162c725b55cd6770480b31bb85f/src/routes/ellipse/latex.ts
export function ellipseLatex(
  x: string | number,
  y: string | number,
  rx: string | number,
  ry: string | number,
  angle: string | number
) {
  x = formatArg(x);
  y = formatArg(y);
  rx = formatArg(rx);
  ry = formatArg(ry);
  angle = formatArg(angle);

  return `\\frac{\\left(\\left(x-${x}\\right)\\cos\\left(${angle}\\right)+\\left(y-${y}\\right)\\sin\\left(${angle}\\right)\\right)^{2}}{${rx}^{2}}+\\frac{\\left(\\left(x-${x}\\right)\\sin\\left(${angle}\\right)-\\left(y-${y}\\right)\\cos\\left(${angle}\\right)\\right)^{2}}{${ry}^{2}}<1`;
}

export function formatArg(arg: string | number) {
  return typeof arg === "number" ? `\\left(${arg}\\right)` : arg;
}
