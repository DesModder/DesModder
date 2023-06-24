import {
  PartialFunctionCall,
  TryFindMQIdentResult,
  getController,
  getMathquillIdentifierAtCursorPosition,
  getPartialFunctionCall,
  mapAugAST,
} from "./latex-parsing";
import { IntellisenseState } from "./state";
import { View, addBracketsToIdent } from "./view";
import { DCGView, MountedComponent } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { registerCustomDispatchOverridingHandler } from "plugins/compact-view/override-dispatch";
import { getMetadata } from "plugins/manage-metadata/manage";
import { ItemAug } from "plugins/text-mode/aug/AugState";

export type BoundIdentifier =
  | {
      exprId: string;
      variableName: string;
      type:
        | "variable"
        | "function-param"
        | "listcomp-param"
        | "substitution"
        | "derivative"
        | "repeated-operator";
      id: number;
    }
  | BoundIdentifierFunction;

export interface BoundIdentifierFunction {
  exprId: string;
  variableName: string;
  type: "function";
  id: number;
  params: string[];
}

export function getMQCursorPosition(focusedMQ: MathQuillField) {
  return getController(
    focusedMQ
  ).cursor?.cursorElement?.getBoundingClientRect();
}

const intellisenseMountPoint = document.createElement("div");
document.body.appendChild(intellisenseMountPoint);
intellisenseMountPoint.tabIndex = -1;

export default class Intellisense extends PluginController {
  static id = "intellisense" as const;
  static enabledByDefault = true;

  view: MountedComponent | undefined;

  x: number = 0;
  y: number = 0;

  intellisenseOpts: BoundIdentifier[] = [];
  intellisenseIndex: number = -1;

  latestIdent: TryFindMQIdentResult | undefined;
  latestMQ: MathQuillField | undefined;

  intellisenseReturnMQ: MathQuillField | undefined;
  prevCursorElem: Element | undefined;
  goRightBeforeReturningToMQ: boolean = false;

  idcounter = 0;

  partialFunctionCall: PartialFunctionCall | undefined;
  partialFunctionCallIdent: BoundIdentifier | undefined;
  partialFunctionCallDoc: string | undefined;

  intellisenseState = new IntellisenseState(getMetadata());

  canHaveIntellisense = false;

  updateIntellisense() {
    const focusedMQ = MathQuillView.getFocusedMathquill();
    this.intellisenseOpts = [];

    // is there actually a focused mathquill window?
    if (focusedMQ) {
      // find the identifier the cursor is at
      this.latestIdent = getMathquillIdentifierAtCursorPosition(focusedMQ);
      if (this.latestIdent)
        this.latestIdent.ident = this.latestIdent.ident.replace(/ /g, "");

      this.latestMQ = focusedMQ;

      // determine if the user is in a partial function call
      this.partialFunctionCall = getPartialFunctionCall(focusedMQ);
      this.partialFunctionCallIdent = Array.from(
        this.intellisenseState.boundIdentifiers()
      ).find(
        (i) =>
          addBracketsToIdent(i.variableName) ===
            this.partialFunctionCall?.ident && i.type === "function"
      );

      // if the user is in a partial function call,
      // find its documentation if it exists
      const models = Calc.controller.getAllItemModels();
      let found = false;
      for (let i = 0; i < models.length; i++) {
        const current = models[i];
        if (
          this.partialFunctionCallIdent &&
          current.type === "text" &&
          models[i + 1]?.type === "expression" &&
          this.partialFunctionCallIdent.exprId === models[i + 1]?.id
        ) {
          this.partialFunctionCallDoc = current.text;
          found = true;
        }
      }
      if (!found) this.partialFunctionCallDoc = undefined;

      // determine where to put intellisense window
      const bbox = getMQCursorPosition(focusedMQ);
      this.x = bbox?.left ?? 0;
      this.y = bbox?.top ?? 0;

      // create filtered list of valid intellisense options
      if (this.latestIdent) {
        this.intellisenseOpts = Array.from(
          this.intellisenseState.boundIdentifiers()
        ).filter((g) =>
          g.variableName.startsWith(
            this.latestIdent?.ident.replace(/[{} \\]/g, "") ?? ""
          )
        );
      }

      // if there isn't, just get rid of the intellisense window
    } else {
      this.latestIdent = undefined;
      this.latestMQ = undefined;
      this.intellisenseIndex = -1;
    }

    // update intellisense window
    this.view?.update();
  }

  leaveIntellisenseMenu() {
    this.intellisenseReturnMQ?.focus();

    if (this.prevCursorElem instanceof HTMLElement) {
      this.prevCursorElem?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
      this.prevCursorElem?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );
      if (this.goRightBeforeReturningToMQ) this.latestMQ?.keystroke("Right");
    }
  }

  afterEnable() {
    // eslint-disable-next-line no-console
    console.log("Intellisense Enabled!");

    document.addEventListener("focusout", (e) => {
      console.log(e.target, e.relatedTarget);
      if (
        e.target !== intellisenseMountPoint &&
        e.relatedTarget !== intellisenseMountPoint
      ) {
        this.canHaveIntellisense = false;
        console.log("asdasdasd");
      }
    });

    registerCustomDispatchOverridingHandler((evt) => {
      if (evt.type === "on-special-key-pressed" && evt.key === "Down") {
        if (this.intellisenseOpts.length > 1 && this.canHaveIntellisense) {
          if (this.latestMQ) {
            this.prevCursorElem = getController(
              this.latestMQ
            )?.cursor?.[1]?._el;
            this.goRightBeforeReturningToMQ = false;
            if (!this.prevCursorElem) {
              this.prevCursorElem = getController(this.latestMQ)?.cursor?.[
                -1
              ]?._el;
              this.goRightBeforeReturningToMQ = true;
            }
          }
          this.intellisenseReturnMQ = this.latestMQ;
          setTimeout(() => {
            intellisenseMountPoint.focus();
            Calc.controller.dispatch({
              type: "set-none-selected",
            });
          }, 0);
          this.intellisenseIndex = 0;
          this.view?.update();
          return false;
        }
      }
    }, 1);

    document.addEventListener("keydown", (e) => {
      if (!e.key.startsWith("Arrow")) {
        this.canHaveIntellisense = true;
      }

      // navigating downward in the intellisense menu
      if (
        e.key === "ArrowDown" &&
        this.intellisenseOpts.length > 0 &&
        document.activeElement === intellisenseMountPoint &&
        (addBracketsToIdent(this.intellisenseOpts[0].variableName) !==
          this.latestIdent?.ident ||
          this.intellisenseOpts.length > 1)
      ) {
        this.intellisenseIndex = Math.min(
          this.intellisenseIndex + 1,
          this.intellisenseOpts.length - 1
        );
        this.view?.update();
        e.preventDefault();
        return false;

        // navigating upward in the intellisense menu
      } else if (e.key === "ArrowUp" && this.intellisenseOpts.length > 0) {
        const oldIntellisenseIndex = this.intellisenseIndex;
        this.intellisenseIndex = Math.max(this.intellisenseIndex - 1, 0);

        if (oldIntellisenseIndex === 0) {
          this.leaveIntellisenseMenu();

          return;
        }

        if (this.intellisenseIndex >= 0) {
          this.view?.update();
          e.preventDefault();
          return false;
        }

        // choose autocomplete option with tab or enter
      } else if (
        (e.key === "Enter" || e.key === "Tab") &&
        this.intellisenseIndex >= 0
      ) {
        this.doAutocomplete(this.intellisenseOpts[this.intellisenseIndex]);
        e.preventDefault();
        this.view?.update();

        // force close autocomplete with escape
      } else if (e.key === "Escape") {
        this.intellisenseIndex = -1;
        this.canHaveIntellisense = false;
        this.leaveIntellisenseMenu();
        this.view?.update();
      }

      // Jump to definition
      if (e.key === "F9" && this.latestIdent) {
        this.jumpToDefinition(this.latestIdent.ident);
        this.canHaveIntellisense = false;
        this.leaveIntellisenseMenu();
        this.view?.update();
      }
    });

    document.addEventListener("keyup", () => {
      if (!MathQuillView.getFocusedMathquill()) return;
      this.updateIntellisense();
    });

    document.addEventListener("mouseup", (e) => {
      let elem = e.target;

      // don't update the intellisense if the user is selecting an intellisense result
      while (elem instanceof HTMLElement) {
        // element has intellisense mount point as an ancestor
        if (elem === intellisenseMountPoint) {
          return;
        }
        elem = elem.parentElement;
      }

      this.intellisenseIndex = -1;

      this.updateIntellisense();
    });

    this.view = DCGView.mountToNode(View, intellisenseMountPoint, {
      x: () => this.x,
      y: () => this.y,
      idents: () => this.intellisenseOpts,
      autocomplete: (ident) => this.doAutocomplete(ident),
      index: () => this.intellisenseIndex,
      partialFunctionCall: () => this.partialFunctionCall,
      partialFunctionCallIdent: () => this.partialFunctionCallIdent,
      partialFunctionCallDoc: () => this.partialFunctionCallDoc,
      show: () => this.canHaveIntellisense,
      jumpToDefinition: (name) => this.jumpToDefinition(name),
    });
  }

  jumpToDefinition(name: string) {
    const identDst = Array.from(this.intellisenseState.boundIdentifiers()).find(
      (id) => {
        return (
          (id.type === "function" || id.type === "variable") &&
          addBracketsToIdent(id.variableName) === name
        );
      }
    );

    if (identDst) {
      Calc.controller.dispatch({
        type: "set-selected-id",
        id: identDst.exprId,
      });
    }
    this.canHaveIntellisense = false;
    this.view?.update();
  }

  doAutocomplete(opt: BoundIdentifier) {
    this.leaveIntellisenseMenu();
    if (this.latestIdent && this.latestMQ) {
      this.latestIdent.goToEndOfIdent();
      this.latestIdent.deleteIdent();

      const formattedIdentLatex = addBracketsToIdent(opt.variableName);

      // add parens to function
      if (opt.type === "function") {
        this.latestMQ.typedText(formattedIdentLatex.replace(/\{|\}/g, ""));
        this.latestMQ.keystroke("Right");
        this.latestMQ.typedText("()");
        this.latestMQ.keystroke("Left");
      } else {
        this.latestMQ.typedText(formattedIdentLatex.replace(/\{|\}/g, ""));
      }
    }

    this.intellisenseReturnMQ?.focus();
    this.updateIntellisense();
  }

  afterDisable() {
    // eslint-disable-next-line no-console
    console.log("Disabled");
  }
}
