import {
  ExpressionLibraryFolder,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
} from "./library-statements";
import { CalcController } from "#globals";

export class Inserter {
  constructor(private readonly cc: CalcController) {}

  /** Create an empty folder at/after the selection, and return its index. */
  createEmptyFolder(title: string) {
    const id = this.cc.generateId();
    const model = this.cc.createItemModel({
      type: "folder",
      title,
      id,
    });
    this.cc._toplevelNewItemAtSelection(model, { shouldFocus: false });
    return this.cc.getItemModel(id)!.index;
  }

  /** load all the contents of a folder into the current graph */
  loadFolder(expr: ExpressionLibraryFolder) {
    const startIndex = this.createEmptyFolder(expr.text);

    for (const id of expr.expressions) {
      const e = expr.graph.expressions.get(id);
      if (e && e.type === "expression") {
        this.loadMathExpression(e, startIndex);
      }
    }
  }

  /** Add a single math expression into the graph after `startIndex` */
  loadMathExpression(
    expr: ExpressionLibraryMathExpression,
    startIndex: number,
    dontLoadDependencies = false
  ) {
    // TODO-ml
    // this.focusedmq?.focus();
    const loaded = new Set<ExpressionLibraryMathExpression>();

    const loadExpressionInner = (expr: ExpressionLibraryMathExpression) => {
      if (loaded.has(expr)) return;
      loaded.add(expr);

      if (dontLoadDependencies) return;

      for (const childexprID of expr.dependsOn) {
        const childExpr = expr.graph.expressions.get(childexprID);
        if (childExpr)
          loadExpressionInner(childExpr as ExpressionLibraryMathExpression);
      }
    };

    loadExpressionInner(expr);

    let loadedArray = Array.from(loaded).map((e) => {
      // TODO-ml: needs to be link to avoid rare collisions
      // Or don't overwrite existing (feels weird for insert to be a no-op)
      const id = `dsm-mapped-${e.graph.hash}-${e.raw.id}`;
      return {
        ...e,
        raw: { ...e.raw, id },
        aug: { ...e.aug, id },
        id,
      };
    });

    // deduplicate redundant expressions
    loadedArray = loadedArray.filter(
      (loadExpr) => !this.cc.getItemModel(loadExpr.raw.id)
    );

    startIndex++;
    // figure out what folder to put expressions into
    const startItem = this.cc.listModel.__itemModelArray[startIndex - 1];
    const startFolder: string | undefined =
      startItem?.type === "folder" ? startItem?.id : startItem?.folderId;

    const idsBefore = new Set(
      this.cc.listModel.__itemModelArray.map((e) => e.id)
    );

    for (const e of loadedArray) {
      // TODO-ml: augToRaw
      const model = this.cc.createItemModel(e.raw);
      this.cc._addItemToEndFromAPI(model);
    }

    const idsAfter = this.cc.listModel.__itemModelArray.map((e) => e.id);

    const idsNew: string[] = [];

    for (const id of idsAfter) {
      if (!idsBefore.has(id)) {
        idsNew.push(id);
      }
    }

    // reorder expressions
    let i = 0;
    for (const id of idsNew) {
      const idIndex = this.cc.listModel.__itemModelArray.findIndex(
        (e) => e.id === id
      );
      const itemToMove = this.cc.listModel.__itemModelArray[idIndex];

      const expr = loadedArray[i];

      // set folderid and colorlatex
      itemToMove.folderId = startFolder ?? "";
      if (expr && expr.raw.type === "expression" && expr.raw.colorLatex) {
        itemToMove.colorLatex = expr.raw.colorLatex;
      }

      this.cc.listModel.__itemModelArray.splice(idIndex, 1);

      if (startIndex > idIndex) startIndex--;

      this.cc.listModel.__itemModelArray.splice(startIndex, 0, itemToMove);
      i++;
    }

    this.cc.updateTheComputedWorld();
  }

  /** Load an entire graph into this graph */
  loadEntireGraph(graph: ExpressionLibraryGraph) {
    const startIndex = this.createEmptyFolder(`Graph: ${graph.title}`);

    for (const [_, expr] of Array.from(graph.expressions.entries()).reverse()) {
      if (expr.type !== "folder") {
        this.loadMathExpression(expr, startIndex, true);
      }
    }
  }
}
