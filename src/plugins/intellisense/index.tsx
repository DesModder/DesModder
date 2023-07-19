import {
  PartialFunctionCall,
  TryFindMQIdentResult,
  getController,
  getMathquillIdentifierAtCursorPosition,
  getPartialFunctionCall,
} from "./latex-parsing";
import { IntellisenseState } from "./state";
import { pendingIntellisenseTimeouts, setIntellisenseTimeout } from "./utils";
import { JumpToDefinitionMenuInfo, View } from "./view";
import { DCGView, MountedComponent, unmountFromNode } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { ItemModel, TextModel } from "globals/models";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { getMetadata } from "plugins/manage-metadata/manage";
import { hookIntoOverrideKeystroke } from "utils/listenerHelpers";
import { isDescendant } from "utils/utils";

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

export function getSelectedExpressionID(): string | undefined {
  return Calc.controller.getSelectedItem()?.id;
}

export function getExpressionIndex(id: string): number | undefined {
  return Calc.controller.listModel.__itemIdToModel[id]?.index;
}
export function getExpressionLatex(id: string): string | undefined {
  return (
    Calc.controller.listModel.__itemIdToModel[id] as ItemModel & {
      latex: string | undefined;
    }
  ).latex;
}

export default class Intellisense extends PluginController {
  static id = "intellisense" as const;
  static enabledByDefault = false;
  static descriptionLearnMore =
    "https://github.com/DesModder/DesModder/tree/main/src/plugins/intellisense/docs/README.md";

  view: MountedComponent | undefined;

  x: number = 0;
  y: number = 0;

  intellisenseOpts: { idents: BoundIdentifier[] }[] = [];
  intellisenseIndex: number = 0;
  intellisenseRow = 0;

  latestIdent: TryFindMQIdentResult | undefined;
  latestMQ: MathQuillField | undefined;

  intellisenseReturnMQ: MathQuillField | undefined;
  prevCursorPos: { x: number; y: number } | undefined;
  goRightBeforeReturningToMQ: boolean = false;

  idcounter = 0;

  partialFunctionCall: PartialFunctionCall | undefined;
  partialFunctionCallIdent: BoundIdentifierFunction | undefined;
  partialFunctionCallDoc: string | undefined;

  intellisenseState = new IntellisenseState(getMetadata());

  canHaveIntellisense = false;

  intellisenseMountPoint: HTMLElement | undefined;

  jumpToDefState: JumpToDefinitionMenuInfo | undefined;
  jumpToDefIndex: number = 0;

  specialIdentifierNames: string[] = [];

  async waitForCurrentIntellisenseTimeoutsToFinish() {
    await new Promise<void>((resolve) => {
      const currentTimeouts = Array.from(pendingIntellisenseTimeouts.entries());
      const interval = setInterval(() => {
        // only continue if all timeouts have been finished
        for (const timeout of currentTimeouts) {
          if (pendingIntellisenseTimeouts.has(timeout)) return;
        }

        // resolve the promise when timeouts have finished
        clearInterval(interval);
        resolve();
      });
    });
  }

  // recalculate the intellisense
  updateIntellisense() {
    const focusedMQ = MathQuillView.getFocusedMathquill();
    this.saveCursorState();
    this.intellisenseOpts = [];

    const lastIdentStr = this.latestIdent?.ident;

    // is there actually a focused mathquill window?
    if (focusedMQ) {
      // find the identifier the cursor is at
      this.latestIdent = getMathquillIdentifierAtCursorPosition(focusedMQ);
      if (this.latestIdent)
        this.latestIdent.ident = this.latestIdent.ident.replace(/ /g, "");

      this.latestMQ = focusedMQ;

      // determine if the user is in a partial function call
      this.partialFunctionCall = getPartialFunctionCall(focusedMQ);
      this.partialFunctionCallIdent = this.intellisenseState
        .boundIdentifiersArray()
        .find(
          (i) =>
            i.variableName === this.partialFunctionCall?.ident &&
            i.type === "function"
        ) as BoundIdentifierFunction;

      // if the user is in a partial function call,
      // find its documentation if it exists
      const models = Calc.controller.getAllItemModels();
      this.partialFunctionCallDoc = (
        models.find((current, i) => {
          if (
            this.partialFunctionCallIdent &&
            current.type === "text" &&
            models[i + 1]?.type === "expression" &&
            this.partialFunctionCallIdent.exprId === models[i + 1]?.id
          ) {
            return true;
          }
          return false;
        }) as TextModel | undefined
      )?.text;

      // determine where to put intellisense window
      const bbox = getMQCursorPosition(focusedMQ);
      if (bbox && bbox?.left !== 0 && bbox?.top !== 0) {
        this.x = bbox.left;
        this.y = bbox.top;
      } else {
        this.canHaveIntellisense = false;
        this.view?.update();
        return;
      }

      // create filtered list of valid intellisense options
      if (this.latestIdent) {
        const noRepeatIntellisenseOpts = this.intellisenseState
          .boundIdentifiersArray()
          .filter((g) =>
            g.variableName.startsWith(
              this.latestIdent?.ident.replace(/[{} \\]/g, "") ?? ""
            )
          );

        const intellisenseOptsMap = new Map<string, BoundIdentifier[]>();
        for (const opt of noRepeatIntellisenseOpts) {
          const entry = intellisenseOptsMap.get(opt.variableName);
          if (entry) {
            entry.push(opt);
          } else {
            intellisenseOptsMap.set(opt.variableName, [opt]);
          }
        }

        this.intellisenseOpts = Array.from(intellisenseOptsMap.entries()).map(
          ([_, idents]) => {
            return {
              idents,
            };
          }
        );

        // sort the intellisense options so that closer ones appear first
        const listModel = Calc.controller.listModel;
        const orderMap = new Map<string, number>();
        for (let i = 0; i < listModel.drawOrder.length; i++) {
          orderMap.set(listModel.drawOrder[i], i);
        }
        const myindex = Calc.controller.getSelectedItem()?.index;
        if (myindex !== undefined) {
          this.intellisenseOpts.sort((a, b) => {
            const aMin = Math.min(
              ...a.idents.map((e) =>
                Math.abs((orderMap.get(e.exprId) ?? 0) - myindex)
              )
            );
            const bMin = Math.min(
              ...b.idents.map((e) =>
                Math.abs((orderMap.get(e.exprId) ?? 0) - myindex)
              )
            );
            return aMin - bMin;
          });
        }

        if (this.latestIdent.ident !== lastIdentStr) this.intellisenseIndex = 0;
      } else {
        this.intellisenseOpts = [];
      }

      // if there isn't, just get rid of the intellisense window
    } else {
      this.intellisenseOpts = [];
      this.latestIdent = undefined;
      this.latestMQ = undefined;
      this.canHaveIntellisense = false;
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
      const mqRootBlock = getController(this.latestMQ).container.querySelector(
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
      getController(this.latestMQ).container.dispatchEvent(
        new MouseEvent("mousedown", eventHandlerSettings)
      );
      getController(this.latestMQ).container.dispatchEvent(
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
      document.body.contains(
        getController(this.latestMQ).cursor.cursorElement ?? null
      )
    ) {
      // get cursor pos relative to the top left of the mathquill's root element
      const mqRootBlock = getController(this.latestMQ).container.querySelector(
        ".dcg-mq-root-block"
      );

      if (!mqRootBlock) return;
      const mqRootBlockRect = mqRootBlock.getBoundingClientRect();
      const rect = getController(
        this.latestMQ
      ).cursor.cursorElement?.getBoundingClientRect();
      this.prevCursorPos = {
        x: rect?.x ?? 0 + mqRootBlock.scrollLeft - mqRootBlockRect.x,
        y: rect?.y ?? 0 + mqRootBlock.scrollTop - mqRootBlockRect.y,
      };
    }
  }

  focusOutHandler = (e: FocusEvent) => {
    if (e.relatedTarget !== null) {
      this.canHaveIntellisense = false;
      this.view?.update();
    }
  };

  modifiedOverrideKeystrokeUnsubbers: (() => void)[] = [];

  goToNextIntellisenseCol() {
    this.intellisenseIndex = Math.min(
      this.intellisenseIndex + 1,
      this.intellisenseOpts.length - 1
    );
  }

  goToPrevIntellisenseCol() {
    this.intellisenseIndex = Math.max(this.intellisenseIndex - 1, 0);
  }

  focusInHandler = () => {
    setIntellisenseTimeout(() => {
      if (Calc.focusedMathQuill && this.specialIdentifierNames.length === 0) {
        this.specialIdentifierNames = [
          ...Object.keys(Calc.focusedMathQuill.mq.__options.autoOperatorNames),
          ...Object.keys(Calc.focusedMathQuill.mq.__options.autoCommands),
        ];
      }

      // done because the monkeypatch has a different this value
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      if (Calc.focusedMathQuill) {
        // monkeypatch in a function to wrap overrideKeystroke
        const remove = hookIntoOverrideKeystroke(
          Calc.focusedMathQuill.mq,
          function (key: string, _: KeyboardEvent) {
            if (
              // don't bother overriding keystroke if intellisense is offline
              !self.canHaveIntellisense ||
              self.intellisenseOpts.length === 0
            )
              // return nothing to ensure the actual overrideKeystroke runs
              return;

            // navigating downward in the intellisense menu
            if (key === "Down") {
              self.goToNextIntellisenseCol();
              self.view?.update();
              return false;

              // navigating upward in the intellisense menu
            } else if (key === "Up") {
              self.goToPrevIntellisenseCol();

              self.view?.update();
              return false;

              // selecting and autocompleting an intellisense selection
              // or jump to def if in row 1
            } else if (
              key === "Enter" &&
              self.intellisenseOpts[self.intellisenseIndex] !== undefined
            ) {
              if (self.intellisenseRow === 0) {
                self.doAutocomplete(
                  self.intellisenseOpts[self.intellisenseIndex].idents[0]
                );
                self.view?.update();
              } else {
                const str =
                  self.intellisenseOpts[self.intellisenseIndex].idents[0]
                    .variableName;

                // need a delay so that Enter key doesn't immediately close
                // the jump2def window
                setIntellisenseTimeout(() => {
                  self.jumpToDefinition(str);
                });
              }
              return false;

              // navigate by row up
            } else if (key === "Tab") {
              self.intellisenseRow++;
              if (self.intellisenseRow > 1) {
                self.intellisenseRow = 0;
                self.goToNextIntellisenseCol();
              }
              self.view?.update();
              return false;

              // navigate by row down
            } else if (key === "Shift-Tab") {
              self.intellisenseRow--;
              if (self.intellisenseRow < 0) {
                self.intellisenseRow = 1;
                self.goToPrevIntellisenseCol();
              }
              self.view?.update();
              return false;
            }
            // close intellisense menu
            // or jump2def menu
            else if (key === "Esc") {
              self.canHaveIntellisense = false;
              self.view?.update();
              return false;
            }
          },
          0,
          "intellisense"
        );

        if (remove) this.modifiedOverrideKeystrokeUnsubbers.push(remove);
      }
    });
  };

  // allows mathquill inputs that only allow arithmetic to selectively disable intellisense
  isActiveElementValidForIntellisense() {
    return (
      document.activeElement
        ?.closest(
          ".yes-intellisense, .no-intellisense, .dcg-settings-view-container"
        )
        ?.classList.contains("yes-intellisense") ?? true
    );
  }

  keyDownHandler = (e: KeyboardEvent) => {
    this.saveCursorState();

    if (
      e.key === "Tab" &&
      this.canHaveIntellisense &&
      this.intellisenseOpts.length !== 0
    ) {
      e.preventDefault();
    }

    if (e.key === "Escape") {
      this.jumpToDefState = undefined;
      this.view?.update();
    }

    // if a non arrow key is pressed in an expression,
    // we enable the intellisense window
    if (
      !e.key.startsWith("Arrow") &&
      e.key !== "Enter" &&
      e.key !== "Escape" &&
      this.isActiveElementValidForIntellisense()
    ) {
      this.canHaveIntellisense = true;
    }

    // Jump to definition
    if (e.key === "F9" && this.latestIdent) {
      this.jumpToDefinition(this.latestIdent.ident);
      this.canHaveIntellisense = false;
      this.view?.update();
      e.preventDefault();
      return false;
    }

    // jump to def menu kb nav and selection
    if (this.jumpToDefState) {
      if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        this.jumpToDefIndex = Math.max(0, this.jumpToDefIndex - 1);
        this.view?.update();
      } else if (e.key === "ArrowDown" || e.key === "Tab") {
        this.jumpToDefIndex = Math.min(
          this.jumpToDefState.idents.length - 1,
          this.jumpToDefIndex + 1
        );
        this.view?.update();
      } else if (e.key === "Enter") {
        const id =
          this.jumpToDefState.idents[this.jumpToDefIndex]?.sourceExprId;
        if (id) this.jumpToDefinitionById(id);
      }
    }
  };

  keyUpHandler = () => {
    if (!MathQuillView.getFocusedMathquill()) return;
    this.updateIntellisense();
    this.saveCursorState();
  };

  lastExppanelScrollTop = 0;

  mouseUpHandler = (e: MouseEvent) => {
    const elem = e.target;

    // don't update the intellisense if the user is selecting an intellisense result
    if (
      elem instanceof HTMLElement &&
      this.intellisenseMountPoint &&
      isDescendant(elem, this.intellisenseMountPoint)
    )
      return;

    this.canHaveIntellisense = false;
  };

  jumpToDefinitionById(id: string) {
    this.jumpToDefState = undefined;

    // jump to definition
    Calc.controller.dispatch({
      type: "set-selected-id",
      id,
    });
    Calc.controller.dispatch({
      type: "set-focus-location",
      location: {
        type: "expression",
        id,
      },
    });

    // if we jumped to an expression with a folder, open the folder
    // and then re-scroll the expression into view
    const model = Calc.controller.getItemModel(id);
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

    this.view?.update();
  }

  // given an identifier name, jump to its definition
  jumpToDefinition(name: string) {
    const identDsts = this.intellisenseState
      .boundIdentifiersArray()
      .filter((id) => {
        return id.variableName === name;
      });

    if (identDsts.length === 1) {
      this.jumpToDefinitionById(identDsts[0].exprId);
    } else if (identDsts.length > 1) {
      Calc.controller.dispatch({
        type: "set-none-selected",
      });

      (document.activeElement as HTMLElement)?.blur?.();

      this.jumpToDefState = {
        varName: identDsts[0].variableName,
        idents: identDsts.map((dst) => {
          return {
            ident: dst,
            sourceExprId: dst.exprId,
            sourceExprIndex: getExpressionIndex(dst.exprId) ?? 0,
            sourceExprLatex: getExpressionLatex(dst.exprId) ?? "",
          };
        }),
      };
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

      const formattedIdentLatex = opt.variableName;

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
        // if we have a subscript, leave it by going right
        if (formattedIdentLatex.includes("_")) this.latestMQ.keystroke("Right");
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

  closeJumpToDefMenu() {
    this.jumpToDefState = undefined;
  }

  dispatcher: string | undefined;

  afterEnable() {
    const exppanel = document.querySelector(".dcg-exppanel");
    this.lastExppanelScrollTop = exppanel?.scrollTop ?? 0;

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
    this.intellisenseMountPoint = document.createElement("div");
    document.body.appendChild(this.intellisenseMountPoint);
    this.view = DCGView.mountToNode(View, this.intellisenseMountPoint, {
      plugin: () => this,
    });

    this.dispatcher = Calc.controller.dispatcher.register((e) => {
      if (e.type === "set-focus-location" || e.type === "set-none-selected") {
        setIntellisenseTimeout(() => {
          if (!Calc.focusedMathQuill) {
            this.canHaveIntellisense = false;
            this.view?.update();
          }
        }, 100);
      }

      if (e.type === "tick") {
        const exppanel = document.querySelector(".dcg-exppanel");
        const newExppanelScrollTop = exppanel?.scrollTop ?? 0;
        this.y += this.lastExppanelScrollTop - newExppanelScrollTop;
        this.view?.update();
        this.lastExppanelScrollTop = newExppanelScrollTop;
      }

      if (e.type === "delete-item-and-animate-out") {
        this.canHaveIntellisense = false;
        this.view?.update();
      }
    });
  }

  afterDisable() {
    // clear event listeners
    document.removeEventListener("focusout", this.focusOutHandler);
    document.removeEventListener("focusin", this.focusInHandler);
    document.removeEventListener("keydown", this.keyDownHandler);
    document.removeEventListener("keyup", this.keyUpHandler);
    document.removeEventListener("mouseup", this.mouseUpHandler);

    // unmodify any remaining keystroke functions
    for (const unsub of this.modifiedOverrideKeystrokeUnsubbers) {
      unsub();
    }

    if (this.intellisenseMountPoint) {
      unmountFromNode(this.intellisenseMountPoint);
      document.body.removeChild(this.intellisenseMountPoint);
    }

    if (this.dispatcher) Calc.controller.dispatcher.unregister(this.dispatcher);
  }
}
