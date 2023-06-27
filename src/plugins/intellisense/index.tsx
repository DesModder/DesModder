import {
  PartialFunctionCall,
  TryFindMQIdentResult,
  getController,
  getMathquillIdentifierAtCursorPosition,
  getPartialFunctionCall,
} from "./latex-parsing";
import { IntellisenseState } from "./state";
import { View, addBracketsToIdent } from "./view";
import { DCGView, MountedComponent } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { getMetadata } from "plugins/manage-metadata/manage";

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

  // leave an intellisense menu and return to whatever expression
  // you were previously in
  leaveIntellisenseMenu() {
    if (this.intellisenseReturnMQ) {
      this.intellisenseReturnMQ?.focus();
      this.latestMQ = this.intellisenseReturnMQ;
    }

    if (this.prevCursorElem instanceof HTMLElement) {
      // simulate a click to get cursor in the right spot
      this.prevCursorElem?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
      this.prevCursorElem?.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true })
      );

      // go right if necessary to properly align cursor
      if (this.goRightBeforeReturningToMQ) {
        this.latestMQ?.keystroke("Right");
      }
    }
  }

  // keep track of where the cursor is so we can return to it
  // once we refocus the mathquill input
  saveCursorState() {
    const focusedmq = MathQuillView.getFocusedMathquill();
    if (focusedmq) this.latestMQ = focusedmq;
    if (this.latestMQ) {
      // try the element to the right
      this.prevCursorElem = getController(this.latestMQ)?.cursor?.[1]?._el;
      this.goRightBeforeReturningToMQ = false;

      // if that doesn't exist, try the element to the left
      if (!this.prevCursorElem) {
        this.prevCursorElem = getController(this.latestMQ)?.cursor?.[-1]?._el;
        this.goRightBeforeReturningToMQ = true;
      }

      // if neither exist, try the parent element
      if (!this.prevCursorElem) {
        this.prevCursorElem = getController(this.latestMQ)?.cursor?.parent?._el;
        this.goRightBeforeReturningToMQ = false;
      }
    }
  }

  afterEnable() {
    // eslint-disable-next-line no-console
    console.log("Intellisense Enabled!");

    // disable intellisense when switching expressions
    document.addEventListener("focusout", (e) => {
      if (
        e.target !== intellisenseMountPoint &&
        e.relatedTarget !== intellisenseMountPoint &&
        e.relatedTarget !== null
      ) {
        this.canHaveIntellisense = false;
      }
    });

    // override the mathquill keystroke handler so that it opens the
    // intellisense menu when I want it to
    document.addEventListener("focusin", () => {
      const mqopts = Calc.focusedMathQuill?.mq?.__controller?.options;

      // done because the monkeypatch has different a different this value
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      if (mqopts && !(mqopts.overrideKeystroke as any).isMonkeypatchedIn) {
        const ovks = mqopts?.overrideKeystroke;
        mqopts.overrideKeystroke = function (key: string, evt: KeyboardEvent) {
          if (
            self.intellisenseOpts.length > 1 &&
            self.canHaveIntellisense &&
            key === "Down"
          ) {
            self.saveCursorState();
            self.intellisenseReturnMQ = self.latestMQ;
            Calc.controller.dispatch({
              type: "set-none-selected",
            });
            intellisenseMountPoint.focus();
            self.intellisenseIndex = -1;
            self.view?.update();
            return false;
          } else {
            ovks(key, evt);
          }
        };

        // prevent repeatedly monkeypatching overrideKeystroke (could cause stack overflow)
        (mqopts.overrideKeystroke as any).isMonkeypatchedIn = true;
      }
    });

    // general intellisense keyboard handler
    document.addEventListener("keydown", (e) => {
      this.saveCursorState();
      // if a non arrow key is pressed in an expression,
      // we enable the intellisense window
      if (!e.key.startsWith("Arrow")) {
        this.canHaveIntellisense = true;
      }

      // navigating downward in the intellisense menu
      if (e.key === "ArrowDown") {
        // is the intellisense menu focused?
        if (document.activeElement === intellisenseMountPoint) {
          if (
            this.intellisenseOpts.length > 0 &&
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
          }

          // try to open the intellisense menu
        }

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
        this.leaveIntellisenseMenu();
        this.jumpToDefinition(this.latestIdent.ident);
        this.canHaveIntellisense = false;
        this.view?.update();
        e.preventDefault();
        return false;
      }
    });

    // update the intellisense on key pressed in a mathquill
    document.addEventListener("keyup", () => {
      if (!MathQuillView.getFocusedMathquill()) return;
      this.updateIntellisense();
      this.saveCursorState();
    });

    // close intellisense when clicking outside the intellisense window
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
      //this.canHaveIntellisense = false;
    });

    // create initial intellisense window
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

  // given an identifier name, jump to its definition
  jumpToDefinition(name: string) {
    const identDst = Array.from(this.intellisenseState.boundIdentifiers()).find(
      (id) => {
        return addBracketsToIdent(id.variableName) === name;
      }
    );

    if (identDst) {
      Calc.controller.dispatch({
        type: "set-selected-id",
        id: identDst.exprId,
      });
      Calc.controller.dispatch({
        type: "set-focus-location",
        location: {
          type: "expression",
          id: identDst.exprId,
        },
      });

      const model = Calc.controller.listModel.__itemIdToModel[identDst.exprId];

      if (model && model.type !== "folder" && model.folderId) {
        Calc.controller.dispatch({
          type: "set-folder-collapsed",
          id: model.folderId,
          isCollapsed: false,
        });

        document
          .querySelector(".dcg-expressionitem.dcg-selected")
          ?.scrollIntoView({ block: "center" });

        const dcgcontainer = document.querySelector(".dcg-container");
        if (dcgcontainer) dcgcontainer.scrollTop = 0;
      }
    }
    this.canHaveIntellisense = false;
    this.view?.update();
  }

  // delete an identifier and then replace it with something
  doAutocomplete(opt: BoundIdentifier) {
    this.leaveIntellisenseMenu();
    console.log(this.latestIdent, this.latestMQ);
    if (this.latestIdent && this.latestMQ) {
      this.latestIdent.goToEndOfIdent();
      this.latestIdent.deleteIdent();

      const formattedIdentLatex = addBracketsToIdent(opt.variableName);

      // add parens to function
      if (opt.type === "function") {
        // .latex() seems to just delete everything from the input
        // so we have to use .typedText()
        this.latestMQ.typedText(formattedIdentLatex.replace(/\{|\}/g, ""));
        this.latestMQ.keystroke("Right");
        this.latestMQ.typedText("()");
        this.latestMQ.keystroke("Left");

        // add back in variable
      } else {
        this.latestMQ.typedText(formattedIdentLatex.replace(/\{|\}/g, ""));
      }
    }

    this.intellisenseReturnMQ?.focus();
    this.canHaveIntellisense = false;
    this.updateIntellisense();
    this.view?.update();
  }

  afterDisable() {
    // eslint-disable-next-line no-console
    console.log("Disabled");
  }
}
