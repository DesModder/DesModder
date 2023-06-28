import {
  PartialFunctionCall,
  TryFindMQIdentResult,
  getController,
  getMathquillIdentifierAtCursorPosition,
  getPartialFunctionCall,
} from "./latex-parsing";
import { IntellisenseState } from "./state";
import { View, addBracketsToIdent } from "./view";
import { DCGView, MountedComponent, unmountFromNode } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { getMetadata } from "plugins/manage-metadata/manage";
import { attach, propGetSet } from "utils/listenerHelpers";

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

export function getSelectedExpressionID(): string | undefined {
  return Object.keys(Calc.controller.listModel.selectedItemMap)[0];
}

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
  prevCursorPos: { x: number; y: number } | undefined;
  goRightBeforeReturningToMQ: boolean = false;

  idcounter = 0;

  partialFunctionCall: PartialFunctionCall | undefined;
  partialFunctionCallIdent: BoundIdentifier | undefined;
  partialFunctionCallDoc: string | undefined;

  intellisenseState = new IntellisenseState(getMetadata());

  canHaveIntellisense = false;

  // recalculate the intellisense
  updateIntellisense() {
    const focusedMQ = MathQuillView.getFocusedMathquill();
    this.saveCursorState();
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

        // sort the intellisense options so that closer ones appear first
        const listModel = Calc.controller.listModel;
        const orderMap = new Map<string, number>();
        for (let i = 0; i < listModel.drawOrder.length; i++) {
          orderMap.set(listModel.drawOrder[i], i);
        }
        const selectedId = getSelectedExpressionID();
        if (selectedId) {
          const myindex = orderMap.get(selectedId) ?? 0;
          this.intellisenseOpts.sort((a, b) => {
            return (
              Math.abs((orderMap.get(a.exprId) ?? 0) - myindex) -
              Math.abs((orderMap.get(b.exprId) ?? 0) - myindex)
            );
          });
        }

        if (this.intellisenseIndex === -1) this.intellisenseIndex = 0;
      } else {
        this.intellisenseOpts = [];
        this.intellisenseIndex = -1;
      }

      // if there isn't, just get rid of the intellisense window
    } else {
      this.intellisenseOpts = [];
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

    if (this.prevCursorPos && this.latestMQ) {
      const mqRootBlock =
        this.latestMQ.__controller.container.querySelector(
          ".dcg-mq-root-block"
        );

      if (!mqRootBlock) return;

      const mqRootBlockRect = mqRootBlock.getBoundingClientRect();

      // simulate a click to get cursor in the right spot
      const eventHandlerSettings = {
        bubbles: true,
        clientX:
          this.prevCursorPos.x - mqRootBlock.scrollLeft + mqRootBlockRect.x,
        clientY:
          this.prevCursorPos.y - mqRootBlock.scrollTop + mqRootBlockRect.y,
      };
      this.latestMQ.__controller.container.dispatchEvent(
        new MouseEvent("mousedown", eventHandlerSettings)
      );
      this.latestMQ.__controller.container.dispatchEvent(
        new MouseEvent("mouseup", eventHandlerSettings)
      );
    }
  }

  // keep track of where the cursor is so we can return to it
  // once we refocus the mathquill input
  saveCursorState() {
    const focusedmq = MathQuillView.getFocusedMathquill();
    if (focusedmq) this.latestMQ = focusedmq;
    if (
      this.latestMQ &&
      document.body.contains(this.latestMQ.__controller.cursor.cursorElement)
    ) {
      // get cursor pos relative to the top left of the mathquill's root element
      const mqRootBlock =
        this.latestMQ.__controller.container.querySelector(
          ".dcg-mq-root-block"
        );

      if (!mqRootBlock) return;
      const mqRootBlockRect = mqRootBlock.getBoundingClientRect();
      const rect =
        this.latestMQ.__controller.cursor.cursorElement.getBoundingClientRect();
      this.prevCursorPos = {
        x: rect.x + mqRootBlock.scrollLeft - mqRootBlockRect.x,
        y: rect.y + mqRootBlock.scrollTop - mqRootBlockRect.y,
      };
    }
  }

  focusOutHandler = (e: FocusEvent) => {
    if (
      e.target !== intellisenseMountPoint &&
      e.relatedTarget !== intellisenseMountPoint &&
      e.relatedTarget !== null
    ) {
      this.canHaveIntellisense = false;
    }
  };

  modifiedOverrideKeystrokeUnsubbers: (() => void)[] = [];

  focusInHandler = () => {
    setTimeout(() => {
      const mqopts = Calc.focusedMathQuill?.mq?.__controller?.options;

      // done because the monkeypatch has different a different this value
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      if (mqopts && !(mqopts.overrideKeystroke as any).isMonkeypatchedIn) {
        // monkeypatch in a function to wrap overrideKeystroke
        const remove = attach<(key: string, evt: KeyboardEvent) => void>(
          ...propGetSet(mqopts, "overrideKeystroke"),
          function (key: string, _: KeyboardEvent) {
            // the only intellisense option is already complete
            // so don't bother using it
            if (
              self.intellisenseOpts.length === 1 &&
              addBracketsToIdent(self.intellisenseOpts[0].variableName) ===
                self.latestIdent?.ident
            )
              // return nothing to ensure the actual overrideKeystroke runs
              return;

            // navigating downward in the intellisense menu
            if (key === "Down") {
              if (self.intellisenseOpts.length > 0) {
                self.intellisenseIndex = Math.min(
                  self.intellisenseIndex + 1,
                  self.intellisenseOpts.length - 1
                );
                self.view?.update();
                return [false, undefined];
              }

              // navigating upward in the intellisense menu
            } else if (key === "Up" && self.intellisenseOpts.length > 0) {
              self.intellisenseIndex = Math.max(self.intellisenseIndex - 1, 0);

              self.view?.update();
              return [false, undefined];

              // selecting and autocompleting an intellisense selection
            } else if (
              (key === "Enter" || key === "Tab") &&
              self.intellisenseIndex >= 0
            ) {
              self.doAutocomplete(
                self.intellisenseOpts[self.intellisenseIndex]
              );
              self.view?.update();
              return [false, undefined];
            }
          }
        );

        this.modifiedOverrideKeystrokeUnsubbers.push(remove);

        // prevent repeatedly monkeypatching overrideKeystroke (could cause stack overflow)
        (mqopts.overrideKeystroke as any).isMonkeypatchedIn = true;
      }
    });
  };

  keyDownHandler = (e: KeyboardEvent) => {
    this.saveCursorState();
    // if a non arrow key is pressed in an expression,
    // we enable the intellisense window
    if (!e.key.startsWith("Arrow")) {
      this.canHaveIntellisense = true;
    }

    // close intellisense menu
    if (e.key === "Escape") {
      this.intellisenseIndex = -1;
      this.canHaveIntellisense = false;
      this.view?.update();
    }

    // Jump to definition
    if (e.key === "F9" && this.latestIdent) {
      this.jumpToDefinition(this.latestIdent.ident);
      this.canHaveIntellisense = false;
      this.view?.update();
      e.preventDefault();
      return false;
    }
  };

  keyUpHandler = () => {
    if (!MathQuillView.getFocusedMathquill()) return;
    this.updateIntellisense();
    this.saveCursorState();
  };

  mouseUpHandler = (e: MouseEvent) => {
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
  };

  afterEnable() {
    // eslint-disable-next-line no-console
    console.log("Intellisense Enabled!");

    // disable intellisense when switching expressions
    document.addEventListener("focusout", this.focusOutHandler);

    // override the mathquill keystroke handler so that it opens the
    // intellisense menu when I want it to
    document.addEventListener("focusin", this.focusInHandler);

    // general intellisense keyboard handler
    document.addEventListener("keydown", this.keyDownHandler);

    // update the intellisense on key pressed in a mathquill
    document.addEventListener("keyup", this.keyUpHandler);

    // close intellisense when clicking outside the intellisense window
    document.addEventListener("mouseup", this.mouseUpHandler);

    // create initial intellisense window
    this.view = DCGView.mountToNode(View, intellisenseMountPoint, {
      x: () => this.x,
      y: () => this.y,
      idents: () => this.intellisenseOpts,
      autocomplete: (ident) => {
        this.leaveIntellisenseMenu();
        this.doAutocomplete(ident);
      },
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
      // jump to definition
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

      // if we jumped to an expression with a folder, open the folder
      // and then re-scroll the expression into view
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

    // disable intellisense
    this.canHaveIntellisense = false;
    this.view?.update();
  }

  // delete an identifier and then replace it with something
  doAutocomplete(opt: BoundIdentifier) {
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
        this.latestMQ.keystroke("Right");
      }
    }

    this.intellisenseReturnMQ?.focus();
    this.canHaveIntellisense = false;
    this.updateIntellisense();
    this.view?.update();

    const selectedid = getSelectedExpressionID();

    // force calc to realize something's changed
    if (this.intellisenseReturnMQ && selectedid) {
      Calc.controller.dispatch({
        type: "set-item-latex",
        id: selectedid,
        latex: this.intellisenseReturnMQ.latex(),
      });
    }
  }

  afterDisable() {
    // clear event listeners
    document.removeEventListener("focusout", this.focusOutHandler);
    document.removeEventListener("focusin", this.focusInHandler);
    document.removeEventListener("keydown", this.keyDownHandler);
    document.removeEventListener("keyup", this.keyUpHandler);
    document.removeEventListener("mouseup", this.mouseUpHandler);

    // eslint-disable-next-line no-console
    console.log("Disabled");

    // unmodify any remaining keystroke functions
    for (const unsub of this.modifiedOverrideKeystrokeUnsubbers) {
      unsub();
    }

    unmountFromNode(intellisenseMountPoint);
  }
}
