import { BoundIdentifier } from ".";
import {
  buildConfigFromGlobals,
  parseRootLatex,
} from "../../../text-mode-core";
import { mapAugAST } from "./latex-parsing";
import type { Calc, DispatchedEvent, ItemModel } from "#globals";
import { rootKeys } from "#plugins/find-replace/backend.ts";
import { get } from "#utils/utils.ts";

function getOrMakeKey<K, V>(map: Map<K, V>, k: K, v: () => V) {
  if (map.has(k)) {
    return map.get(k) as V;
  } else {
    const newV = v();
    map.set(k, newV);
    return newV;
  }
}

function undefinedIfErr<T>(cb: () => T): T | undefined {
  try {
    return cb();
  } catch {}
}

export class IntellisenseState {
  // maps an expression ID to every bound identifier in that expression
  boundIdentifiersInExpressions = new Map<string, BoundIdentifier[]>();

  // maps an identifier name to every expression ID where it is referenced
  identifierReferences = new Map<string, Set<string>>();

  // maps an expression ID to every identifier it references
  identifiersReferencedInExpression = new Map<string, Set<string>>();

  counter = 0;
  cc = this.calc.controller;

  getIdentDoc(ident: BoundIdentifier) {
    const mdl = this.cc.getItemModelByIndex(
      (this.cc.getItemModel(ident.exprId)?.index ?? 0) - 1
    );
    return mdl?.type === "text" ? mdl.text : undefined;
  }

  getIdentFolderDoc(ident: BoundIdentifier) {
    const mdl = this.cc.getItemModel(ident.exprId);
    if (!mdl?.folderId) return undefined;
    const folderModel = this.cc.getItemModel(mdl.folderId);
    return folderModel?.type === "folder" ? folderModel?.title : undefined;
  }

  getIdentFolderId(ident: BoundIdentifier) {
    return this.cc.getItemModel(ident.exprId)?.folderId;
  }

  readonly cfg = buildConfigFromGlobals(Desmos, this.calc);

  vanillaWorkerPoolSendMessage: undefined | ((payload: unknown) => void);

  constructor(public calc: Calc) {}

  afterEnable() {
    const wpc = this.cc.evaluator.workerPoolConnection;
    this.vanillaWorkerPoolSendMessage = wpc.sendMessage.bind(wpc);
    wpc.sendMessage = this.workerPoolSendMessage.bind(this);

    this.setAllState();
  }

  afterDisable() {
    this.cc.evaluator.workerPoolConnection.sendMessage =
      this.vanillaWorkerPoolSendMessage!;
  }

  /**
   * This is a hook into a Desmos function. The payload is typically
   *  {
   *    isCompleteState?: boolean,
   *    statements?: Record<string, ItemModel>,
   *    removes?: Record<string, boolean>
   *  },
   * but the method feels generic enough that it makes sense to
   * validate the argument here.
   *
   * We piggy-back off the mechanism for sending changed/removed statements
   * to the work. Desmos must have that airtight to make evaluation correct,
   * so we can trust that it is more reliable than any event listening.
   */
  workerPoolSendMessage(payload: unknown) {
    this.vanillaWorkerPoolSendMessage!(payload);
    if (typeof payload !== "object" || payload === null) return;
    if ("isCompleteState" in payload && payload.isCompleteState) {
      this.setAllState();
      return;
    }
    // This helps immediately update the intellisense when an assignment
    // is added, but the `formula.expected_variables` is not set correctly here,
    // so e.g. tables and regressions don't get their exports added until
    // the next on-evaluator-changes.
    if ("statements" in payload) {
      const { statements } = payload;
      if (typeof statements !== "object" || statements === null) return;
      for (const id in statements) {
        const model = this.cc.getItemModel(id);
        if (model) this.handleStateChange(model);
      }
    }
    // This is where we robustly handle removed statements.
    if ("removes" in payload) {
      const { removes } = payload;
      if (typeof removes !== "object" || removes === null) return;
      for (const id in removes) {
        this.handleStateRemoval(id);
      }
    }
  }

  handleDispatchedAction(e: DispatchedEvent) {
    switch (e.type) {
      // We handle on-evaluator-changes here because `formula.exported_variables`
      // is now up-to-date, so exports can be found from tables and regressions.
      case "on-evaluator-changes":
        for (const id of Object.keys(e.changes)) {
          const model = this.cc.getItemModel(id);
          if (model) {
            this.handleStateChange(model);
          }
        }
        break;
    }
  }

  *boundIdentifiers() {
    for (const entry of this.boundIdentifiersInExpressions) {
      for (const ident of entry[1]) {
        yield ident;
      }
    }
  }

  boundIdentifiersArray() {
    return Array.from(this.boundIdentifiers());
  }

  setAllState() {
    this.boundIdentifiersInExpressions = new Map();
    this.identifierReferences = new Map();
    this.identifiersReferencedInExpression = new Map();
    for (const model of this.cc.getAllItemModels()) {
      this.handleStateChange(model);
    }
  }

  addIdentifierReference(ident: string, exprId: string) {
    const identRefSet = getOrMakeKey(
      this.identifierReferences,
      ident,
      () => new Set()
    );
    identRefSet.add(exprId);
  }

  removeIdentifierReference(ident: string, exprId: string) {
    const identRefSet = this.identifierReferences.get(ident);
    if (identRefSet) {
      identRefSet.delete(exprId);
    }
  }

  handleStateRemoval(id: string) {
    // remove all references to this identifier
    const oldIdentifiersReferencedInExpression =
      this.identifiersReferencedInExpression.get(id) ?? new Set();
    for (const ident of oldIdentifiersReferencedInExpression) {
      this.removeIdentifierReference(ident, id);
    }

    this.boundIdentifiersInExpressions.delete(id);
    this.identifiersReferencedInExpression.delete(id);
  }

  // handle a change to one expression
  handleStateChange(expression: ItemModel) {
    this.handleStateRemoval(expression.id);

    const newBoundIdentifiers: BoundIdentifier[] = [];

    const newIdentifiersReferenced = new Set<string>();

    let foundTopLevelBinding = false;

    if (expression.type === "expression") {
      for (const key of rootKeys) {
        const ltxStr = get(expression, key);
        if (typeof ltxStr !== "string") continue;
        if (ltxStr.trim() === "") continue;

        const ltx = undefinedIfErr(() => parseRootLatex(this.cfg, ltxStr));

        if (!ltx) continue;

        // add assignments to bound ident list
        if (ltx.type === "Assignment") {
          newBoundIdentifiers.push({
            type: "variable",
            variableName: ltx.left.symbol,
            exprId: expression.id,
            id: this.counter++,
          });
          foundTopLevelBinding = true;
          // add fn def and params to bound ident list
        } else if (ltx.type === "FunctionDefinition") {
          newBoundIdentifiers.push({
            type: "function",
            variableName: ltx.symbol.symbol,
            exprId: expression.id,
            id: this.counter++,
            params: ltx.argSymbols.map((s) => s.symbol),
          });
          newBoundIdentifiers.push(
            ...ltx.argSymbols.map((s) => ({
              type: "function-param" as const,
              variableName: s.symbol,
              exprId: expression.id,
              id: this.counter++,
            }))
          );
          foundTopLevelBinding = true;
        }

        mapAugAST(ltx, (node) => {
          if (!node) return;

          // add referenced identifier
          if (node.type === "Identifier") {
            this.addIdentifierReference(node.symbol, expression.id);
            newIdentifiersReferenced.add(node.symbol);
          }

          // add listcomps, substitutions, derivatives, and repeated ops (e.g. sum)
          if (
            node.type === "ListComprehension" ||
            node.type === "Substitution"
          ) {
            for (const ass of node.assignments) {
              newBoundIdentifiers.push({
                exprId: expression.id,
                variableName: ass.variable.symbol,
                type:
                  node.type === "ListComprehension"
                    ? "listcomp-param"
                    : "substitution",
                id: this.counter++,
              });
            }
          } else if (node.type === "Derivative") {
            newBoundIdentifiers.push({
              exprId: expression.id,
              variableName: node.variable.symbol,
              type: "derivative",
              id: this.counter++,
            });
          } else if (node.type === "RepeatedOperator") {
            newBoundIdentifiers.push({
              exprId: expression.id,
              variableName: node.index.symbol,
              type: "repeated-operator",
              id: this.counter++,
            });
          }
        });
      }
    }

    // Add in `exported_variables` for table columns and regression parameters.
    // We don't use `exported_variables` at all if we have already found
    // an export directly from the LaTeX since `exported_variables` wouldn't
    // give anything new and is probably out-of-date.
    if (!foundTopLevelBinding && "formula" in expression) {
      const exportedVariables = expression.formula?.exported_variables;
      if (exportedVariables && exportedVariables.length > 0) {
        for (const ident of exportedVariables) {
          if (ident.startsWith("idref_") || ident.startsWith("ans")) continue;
          newBoundIdentifiers.push({
            exprId: expression.id,
            variableName: ident,
            type: "other",
            id: this.counter++,
          });
        }
      }
    }

    this.boundIdentifiersInExpressions.set(expression.id, newBoundIdentifiers);
    this.identifiersReferencedInExpression.set(
      expression.id,
      newIdentifiersReferenced
    );
  }
}
