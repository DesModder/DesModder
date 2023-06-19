import { View, addBracketsToIdent } from "./view";
import { GraphState } from "@desmodder/graph-state";
import { DCGView, MountedComponent, jsx } from "DCGView";
import { MathQuillField, MathQuillView } from "components";
import { Calc } from "globals/window";
import { PluginController } from "plugins/PluginController";
import { State, ExpressionAug, ItemAug } from "plugins/text-mode/aug/AugState";
import rawToAug from "plugins/text-mode/aug/rawToAug";
import { updateView } from "plugins/video-creator/View";

export type ExpressionBoundIdentifier =
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
  | ExpressionBoundIdentifierFunction;

export interface ExpressionBoundIdentifierFunction {
  exprId: string;
  variableName: string;
  type: "function";
  id: number;
  params: string[];
}

function mapAugAST(
  node: ExpressionAug["latex"],
  callback: (node: ExpressionAug["latex"]) => void
) {
  function map(x: any) {
    if (Array.isArray(x)) {
      for (const child of x) {
        map(child);
      }
    }

    if (typeof x === "object") {
      if (typeof x.type === "string") callback(x);

      for (const [k, v] of Object.entries(x)) {
        map(v);
      }
    }
  }

  map(node);
}

function getExpressionBoundGlobalIdentifiers(
  expr: ItemAug
): Omit<ExpressionBoundIdentifier, "id">[] {
  if (expr.type === "folder") {
    return expr.children
      .map((c) => getExpressionBoundGlobalIdentifiers(c))
      .flat();
  } else if (expr.type === "expression" && expr.latex) {
    const idents: Omit<ExpressionBoundIdentifier, "id">[] = [];

    mapAugAST(expr.latex, (node) => {
      if (!node) return;
      if (node.type === "ListComprehension" || node.type === "Substitution") {
        for (const ass of node.assignments) {
          idents.push({
            exprId: expr.id,
            variableName: ass.variable.symbol,
            type: "listcomp-param",
          });
        }
      } else if (node.type === "Derivative") {
        idents.push({
          exprId: expr.id,
          variableName: node.variable.symbol,
          type: "derivative",
        });
      } else if (node.type === "RepeatedOperator") {
        idents.push({
          exprId: expr.id,
          variableName: node.index.symbol,
          type: "repeated-operator",
        });
      }
    });

    if (expr.latex.type === "Assignment") {
      idents.push({
        exprId: expr.id,
        variableName: expr.latex.left.symbol,
        type: "variable",
      });
    }
    if (expr.latex.type === "FunctionDefinition") {
      const fndef: ExpressionBoundIdentifier = {
        exprId: expr.id,
        variableName: expr.latex.symbol.symbol,
        type: "function",
        params: expr.latex.argSymbols.map((s) => s.symbol),
        id: -1,
      };
      idents.push(
        fndef,
        ...expr.latex.argSymbols.map((arg) => {
          const x: Omit<ExpressionBoundIdentifier, "id"> = {
            exprId: expr.id,
            variableName: arg.symbol,
            type: "function-param",
          };
          return x;
        })
      );
    }

    return idents;
  }
  return [];
}

const identRegex = /[a-zA-Z]|\\[a-zA-Z]+(_\{[a-zA-Z0-9 ]*\})?/g;

export interface MQController {
  cursor: MQCursor;
}

export interface MQCursor {
  parent?: MQCursor;
  latex?: () => string;
  [-1]: MQCursor | undefined;
  [1]: MQCursor | undefined;
  cursorElement?: HTMLElement;
  ctrlSeq?: string;
}

function getController(mq: MathQuillField) {
  // @ts-expect-error mq controller exists
  return mq.__controller as MQController;
}

function getOptions(mq: MathQuillField) {
  // @ts-expect-error mq options exists
  return mq.__options as MQOptions;
}

function mqKeystroke(mq: MathQuillField, keystroke: string) {
  // @ts-expect-error keystroke can take only one param
  mq.keystroke(keystroke);
}

function isIdentStr(str: string) {
  const match = str.match(identRegex);
  if (!match) return false;
  return match[0].length === str.length;
}

interface TryFindMQIdentResult {
  goToEndOfIdent: () => void;
  deleteIdent: () => void;
  ident: string;
  type: string;
}

function tryGetMathquilIdentFromWithinSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor.parent?.parent?.[-1]?.latex?.();
  const subscript = ctrlr.cursor.parent?.parent?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {
          while (ctrlr.cursor[1]) {
            mqKeystroke(mq, "Right");
          }
          mqKeystroke(mq, "Right");
        },
        deleteIdent: () => {
          for (let i = 0; i < candidate.length - 3; i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        ident: candidate,
        type: "within-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromAfterSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.[-1]?.latex?.();
  const subscript = ctrlr.cursor?.[-1]?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {},
        ident: candidate,
        deleteIdent: () => {
          for (let i = 0; i < candidate.length - 3; i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        type: "after-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromBeforeSubscript(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.latex?.();
  const subscript = ctrlr.cursor?.[1]?.latex?.();
  if (varName && subscript) {
    const candidate = varName + subscript;
    if (isIdentStr(candidate)) {
      return {
        goToEndOfIdent: () => {
          mqKeystroke(mq, "Right");
        },
        ident: candidate,
        deleteIdent: () => {
          for (let i = 0; i < candidate.length - 3; i++) {
            mqKeystroke(mq, "Backspace");
          }
        },
        type: "before-subscript",
      };
    }
  }
}

function tryGetMathquillIdentFromVariableOnly(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  const ctrlr = getController(mq);

  const varName = ctrlr.cursor?.[-1]?.latex?.();
  if (varName) {
    if (isIdentStr(varName)) {
      return {
        goToEndOfIdent: () => {},
        ident: varName,
        deleteIdent: () => {
          mqKeystroke(mq, "Backspace");
        },
        type: "variable-only",
      };
    }
  }
}

function getMathquillIdentifierAtCursorPosition(
  mq: MathQuillField
): TryFindMQIdentResult | undefined {
  // try to get an identifier from a mathquill input
  // at the cursor position in various different ways
  // pick the first one that succeeds
  return (
    tryGetMathquilIdentFromWithinSubscript(mq) ??
    tryGetMathquillIdentFromAfterSubscript(mq) ??
    tryGetMathquillIdentFromBeforeSubscript(mq) ??
    tryGetMathquillIdentFromVariableOnly(mq)
  );
}

export interface PartialFunctionCall {
  ident: string;
  paramIndex: number;
}

function getPartialFunctionCall(
  mq: MathQuillField
): PartialFunctionCall | undefined {
  let cursor: MQCursor | undefined = getController(mq).cursor;
  let paramIndex = 0;
  while (cursor) {
    const ltx = cursor?.latex?.();
    if (ltx === ",") paramIndex++;
    if (cursor[-1]) {
      cursor = cursor[-1];
    } else {
      console.log("fncall is in parent", cursor);
      const oldCursor = cursor;
      cursor = cursor.parent?.parent?.[-1];
      const ltx = cursor?.latex?.();
      const ltx2 = cursor?.[-1]?.latex?.();
      if (ltx && isIdentStr(ltx) && cursor?.[1]?.ctrlSeq === "\\left(") {
        return { ident: ltx, paramIndex };
      } else if (ltx2 && ltx && isIdentStr(ltx2 + ltx)) {
        return { ident: ltx2 + ltx, paramIndex };
      }
      paramIndex = 0;
      cursor = oldCursor.parent;
    }
  }
}

export function getMQCursorPosition(focusedMQ: MathQuillField) {
  return getController(
    focusedMQ
  ).cursor?.cursorElement?.getBoundingClientRect();
}

const intellisenseMountPoint = document.createElement("div");
document.body.appendChild(intellisenseMountPoint);

export default class Intellisense extends PluginController {
  static id = "intellisense" as const;
  static enabledByDefault = true;

  aug: State | undefined = undefined;
  view: MountedComponent | undefined;

  x: number = 0;
  y: number = 0;

  intellisenseOpts: ExpressionBoundIdentifier[] = [];
  intellisenseIndex: number = -1;

  allBoundIdentifiers: ExpressionBoundIdentifier[] = [];

  latestIdent: TryFindMQIdentResult | undefined;
  latestMQ: MathQuillField | undefined;

  intellisenseReturnMQ: MathQuillField | undefined;

  isInIntellisenseMenu: boolean = false;

  idcounter = 0;

  partialFunctionCall: PartialFunctionCall | undefined;

  partialFunctionCallIdent: ExpressionBoundIdentifier | undefined;

  partialFunctionCallDoc: string | undefined;

  reloadState() {
    this.aug = rawToAug(Calc.getState());

    // @ts-expect-error stupid type inference
    this.allBoundIdentifiers = this.aug.expressions.list
      .map((e) => getExpressionBoundGlobalIdentifiers(e))
      .flat()
      .map((e, i) => ({ ...e, id: this.idcounter++ }));
  }

  updateIntellisense() {
    const focusedMQ = MathQuillView.getFocusedMathquill();
    this.intellisenseOpts = [];
    if (focusedMQ) {
      this.latestIdent = getMathquillIdentifierAtCursorPosition(focusedMQ);
      this.latestMQ = focusedMQ;

      this.partialFunctionCall = getPartialFunctionCall(focusedMQ);
      this.partialFunctionCallIdent = this.allBoundIdentifiers.find(
        (i) =>
          addBracketsToIdent(i.variableName) ===
            this.partialFunctionCall?.ident && i.type === "function"
      );

      const exprlist = this.aug?.expressions.list ?? [];

      const findDoc = (exprlist: ItemAug[]) => {
        let found = false;
        for (let i = 0; i < exprlist.length; i++) {
          const current = exprlist[i];
          if (current.type === "folder") findDoc(current.children);
          if (
            this.partialFunctionCallIdent &&
            current.type === "text" &&
            exprlist[i + 1]?.type === "expression" &&
            this.partialFunctionCallIdent.exprId === exprlist[i + 1]?.id
          ) {
            this.partialFunctionCallDoc = current.text;
            found = true;
            //console.log("doc", exprlist[i]);
          }
        }
        if (!found) this.partialFunctionCallDoc = undefined;
      };

      findDoc(exprlist);

      const bbox = getMQCursorPosition(focusedMQ);

      this.x = bbox?.left ?? 0;
      this.y = bbox?.top ?? 0;

      if (this.latestIdent) {
        this.intellisenseOpts = this.allBoundIdentifiers.filter((g) =>
          g.variableName.startsWith(
            this.latestIdent?.ident.replace(/[{|}| ]/g, "") ?? ""
          )
        );
      }
    } else {
      this.latestIdent = undefined;
      this.latestMQ = undefined;
      this.intellisenseIndex = -1;
    }
    this.view?.update();
  }

  afterEnable() {
    // eslint-disable-next-line no-console
    console.log("Intellisense Enabled!");

    Calc.controller.dispatcher.register((e) => {
      if (
        // @ts-expect-error this is an event type in desmos
        e.type === "on-special-key-pressed" &&
        // @ts-expect-error this is an event type in desmos
        e.key === "Down"
      ) {
        if (this.intellisenseOpts.length > 0 && this.intellisenseIndex === -1) {
          // @ts-expect-error blur is part of the mathquill api
          this.latestMQ?.blur();
          this.intellisenseReturnMQ = this.latestMQ;
          setTimeout(
            () =>
              Calc.controller.dispatch({
                type: "set-none-selected",
              }),
            0
          );
          intellisenseMountPoint.focus();
          this.isInIntellisenseMenu = true;
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      // navigating downward in the intellisense menu
      if (
        e.key === "ArrowDown" &&
        this.intellisenseOpts.length > 0 &&
        this.isInIntellisenseMenu &&
        addBracketsToIdent(this.intellisenseOpts[0].variableName) !==
          this.latestIdent?.ident
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
        this.intellisenseIndex = Math.max(this.intellisenseIndex - 1, -1);
        if (this.intellisenseIndex >= 0) {
          this.view?.update();
          e.preventDefault();
        } else {
          // @ts-expect-error focus is part of the mathquill api
          this.intellisenseReturnMQ?.focus();
          this.isInIntellisenseMenu = false;
        }
        return false;

        // choose autocomplete option with tab or enter
      } else if (
        (e.key === "Enter" || e.key === "Tab") &&
        this.intellisenseIndex >= 0
      ) {
        this.doAutocomplete(this.intellisenseOpts[this.intellisenseIndex]);
        e.preventDefault();

        // force close autocomplete with escape
      } else if (e.key === "Escape") {
        // @ts-expect-error focus is part of the mathquill api
        this.intellisenseReturnMQ?.focus();
        this.isInIntellisenseMenu = false;
        this.intellisenseIndex = -1;
      }

      // Jump to definition
      if (e.key === "F9") {
        const identDst = this.allBoundIdentifiers.find((id) => {
          return (
            (id.type === "function" || id.type === "variable") &&
            addBracketsToIdent(id.variableName) === this.latestIdent?.ident
          );
        });

        if (identDst) {
          Calc.controller.dispatch({
            type: "set-selected-id",
            id: identDst.exprId,
          });
        }
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
      this.isInIntellisenseMenu = false;

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
    });

    this.reloadState();

    Calc.observeEvent("change", () => {
      this.reloadState();
    });
  }

  doAutocomplete(opt: ExpressionBoundIdentifier) {
    if (this.latestIdent && this.latestMQ) {
      this.latestIdent.goToEndOfIdent();
      this.latestIdent.deleteIdent();

      const formattedIdentLatex = addBracketsToIdent(opt.variableName);

      // add parens to function
      if (opt.type === "function") {
        // @ts-expect-error latex can take one param
        this.latestMQ.latex(formattedIdentLatex + "\\left(\\right)");
        // @ts-expect-error keystroke can take one param
        this.latestMQ.keystroke("Left");
      } else {
        // @ts-expect-error latex can take one param
        this.latestMQ.latex(formattedIdentLatex);
      }
    }

    // @ts-expect-error focus is part of the mathquill api
    this.intellisenseReturnMQ?.focus();
    this.updateIntellisense();
  }

  afterDisable() {
    // eslint-disable-next-line no-console
    console.log("Disabled");
  }
}
