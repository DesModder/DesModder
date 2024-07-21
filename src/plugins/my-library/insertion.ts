import {
  ExpressionLibraryFolder,
  ExpressionLibraryGraph,
  ExpressionLibraryMathExpression,
} from "./library-statements";
import { type Calc } from "#globals";
import { ExpressionState } from "../../../graph-state";

export class Inserter {
  constructor(private readonly calc: Calc) {}

  /** Create an empty folder at `startIndex` */
  createEmptyFolder(title: string, startIndex: number) {
    this.calc.controller.dispatch({ type: "new-folder" });

    const folder =
      this.calc.controller.listModel.__itemModelArray[startIndex - 1];
    if (folder.type === "folder") {
      folder.title = title;
    }

    this.calc.controller.updateTheComputedWorld();
  }

  /** load all the contents of a folder into the current graph */
  async loadFolder(expr: ExpressionLibraryFolder, startIndex: number) {
    this.createEmptyFolder(expr.text, startIndex);

    for (const id of expr.expressions) {
      const e = expr.graph.expressions.get(id);
      if (e && e.type === "expression") {
        await this.loadMathExpression(e, startIndex);
      }
    }
  }

  /** Add a single math expression into the graph */
  async loadMathExpression(
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
      const id = `dsm-mapped-${e.graph.hash}-${e.raw.id}`;
      return {
        ...e,
        raw: {
          ...e.raw,
          id,
        },
        aug: {
          ...e.aug,
          id,
        },
        id,
      };
    });

    // deduplicate redundant expressions
    loadedArray = loadedArray.filter(
      (loadExpr) => !this.calc.controller.getItemModel(loadExpr.raw.id)
    );

    // figure out what folder to put expressions into
    const startItem =
      this.calc.controller.listModel.__itemModelArray[startIndex - 1];
    const startFolder: string | undefined =
      startItem?.type === "folder" ? startItem?.id : startItem?.folderId;

    const idsBefore = new Set(
      this.calc.controller.listModel.__itemModelArray.map((e) => e.id)
    );

    this.calc.setExpressions(
      // @ts-expect-error todo: fix type safety later
      loadedArray.map((e) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const copy: Partial<ExpressionState> = {
          ...e.raw,
        } as ExpressionState;
        return copy;
      })
    );

    const idsAfter = this.calc.controller.listModel.__itemModelArray.map(
      (e) => e.id
    );

    const idsNew: string[] = [];

    for (const id of idsAfter) {
      if (!idsBefore.has(id)) {
        idsNew.push(id);
      }
    }

    // reorder expressions
    let i = 0;
    for (const id of idsNew) {
      const idIndex = this.calc.controller.listModel.__itemModelArray.findIndex(
        (e) => e.id === id
      );
      const itemToMove =
        this.calc.controller.listModel.__itemModelArray[idIndex];

      const expr = loadedArray[i];

      // set folderid and colorlatex
      itemToMove.folderId = startFolder ?? "";
      if (expr && expr.raw.type === "expression" && expr.raw.colorLatex) {
        itemToMove.colorLatex = expr.raw.colorLatex;
      }

      this.calc.controller.listModel.__itemModelArray.splice(idIndex, 1);

      if (startIndex > idIndex) startIndex--;

      this.calc.controller.listModel.__itemModelArray.splice(
        startIndex,
        0,
        itemToMove
      );
      i++;
    }

    this.calc.controller.updateTheComputedWorld();
  }

  /** Load an entire graph into this graph */
  async loadEntireGraph(graph: ExpressionLibraryGraph, startIndex: number) {
    this.createEmptyFolder(`Graph: ${graph.title}`, startIndex);

    for (const [_, expr] of Array.from(graph.expressions.entries()).reverse()) {
      if (expr.type === "expression") {
        await this.loadMathExpression(expr, startIndex, true);
      }
    }
  }
}
