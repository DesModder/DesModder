import Aug from "text-mode-core/aug/AugState";
import { parseRootLatex, rawNonFolderToAug } from "text-mode-core/aug/rawToAug";
import { textModeExprToLatex } from "text-mode-core/down/textToRaw";
import { getGraphState } from "./library-search-utils";
import { LibrarySearchView } from "./library-search-view";
import { ExpressionState, ItemState } from "@desmodder/graph-state";
import { MountedComponent, jsx } from "#DCGView";
import { MathQuillField, MathQuillView } from "#components";
import { PluginController } from "../PluginController";
import { mapAugAST } from "../intellisense/latex-parsing";
import { IntellisenseState } from "../intellisense/state";
import { getMetadata } from "../manage-metadata/sync";
import { astToText, buildConfigFromGlobals } from "text-mode-core";
import { format } from "localization/i18n-core";
import { rootLatexToAST } from "text-mode-core/up/augToAST";

export interface ExpressionLibraryMathExpression {
  type: "expression";
  aug: Aug.ItemAug;
  latex: string;
  textMode: string;
  // so importing wackscopes works
  dependsOn: Set<string>;
  uniqueID: number;
  graph: ExpressionLibraryGraph;
  raw: ItemState;
}

export interface ExpressionLibraryFolder {
  type: "folder";
  expressions: Set<string>;
  text: string;
  uniqueID: number;
  id: string;
  graph: ExpressionLibraryGraph;
}

export type ExpressionLibraryExpression =
  | ExpressionLibraryMathExpression
  | ExpressionLibraryFolder
  | ExpressionLibraryGraph;

export interface ExpressionLibraryGraph {
  // maps expression IDs to expressions
  expressions: Map<string, ExpressionLibraryExpression>;
  hash: string;
  link: string;
  uniqueID: number;
  type: "graph";
  title?: string;
}

export interface ExpressionsLibraryGraphs {
  graphs: ExpressionLibraryGraph[];
}

type Exhaustive<T, Obj> = keyof Obj extends T ? T[] : never;

type LatexKeysOnly<O> = {
  [K in keyof O as Aug.Latex.AnyRoot extends O[K]
    ? K
    : Aug.Latex.AnyChild extends O[K]
    ? K
    : never]: undefined;
};

function allLatexKeys<Obj>() {
  return function <T>(x: readonly T[]): Exhaustive<T, LatexKeysOnly<Obj>> {
    return x as Exhaustive<T, LatexKeysOnly<Obj>>;
  };
}

function forAllLatexSources(
  item: Aug.ItemAug,
  handler: (ltx: Aug.Latex.AnyRootOrChild) => void
) {
  function runHandler(ltx: string | Aug.Latex.AnyRootOrChild | undefined) {
    if (ltx && typeof ltx === "object") handler(ltx);
  }

  switch (item.type) {
    case "expression":
      for (const key of allLatexKeys<Aug.ExpressionAug>()([
        "latex",
        "color",
        "fillOpacity",
      ] as const)) {
        runHandler(item[key]);
      }
      runHandler(item?.points?.opacity);
      runHandler(item?.points?.size);
      runHandler(item?.lines?.opacity);
      runHandler(item?.lines?.width);
      runHandler(item?.label?.size);
      runHandler(item?.label?.angle);
      runHandler(item?.regression?.residualVariable);
      for (const [k, _] of item.regression?.regressionParameters ?? new Map()) {
        runHandler(k);
      }
      runHandler(item?.cdf?.min);
      runHandler(item?.cdf?.max);
      runHandler(item?.vizProps?.boxplot?.breadth);
      runHandler(item?.vizProps?.boxplot?.axisOffset);

      runHandler(item?.clickableInfo?.latex);
      break;
    case "image":
      for (const key of allLatexKeys<Aug.ImageAug>()([
        "width",
        "height",
        "center",
        "angle",
        "opacity",
      ] as const)) {
        runHandler(item[key]);
      }
      runHandler(item?.clickableInfo?.latex);
      break;
    case "table":
      for (const col of item.columns) {
        for (const key of allLatexKeys<Aug.TableColumnAug>()([
          "color",
          "latex",
        ] as const)) {
          runHandler(col[key]);
        }
        for (const v of col.values) {
          runHandler(v);
        }
      }
  }
}

export function swap<T>(arr: T[], i: number, j: number) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function jsonEqual(a: any, b: any): boolean {
  // check if both arrays are equal if arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((e, i) => jsonEqual(e, b[i]));
  }

  // a and b must have same type
  if (typeof a !== typeof b) return false;

  switch (typeof a) {
    // primitives
    case "string":
    case "boolean":
    case "number":
    case "undefined":
      return a === b;

    // object
    case "object": {
      // null
      if (a === null && b === null) return true;

      // get the union of both objects' keys and compare them
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      return Array.from(keys).every((k) => jsonEqual(a[k], b[k]));
    }
  }

  return false;
}

export const EXPANSIONS_LOCALSTORAGE_KEY = "dsm-my-expr-lib-expansions";

// @ts-expect-error window can have anything on it
window.jsonEqual = jsonEqual;

export default class MyExpressionsLibrary extends PluginController<{
  libraryGraphLinks: string[]; // probably a temporary fix
}> {
  static id = "my-expressions-library" as const;
  static enabledByDefault = true;
  static config = [
    {
      type: "stringArray",
      default: [],
      key: "libraryGraphLinks",
    },
  ] as const;

  graphs: ExpressionsLibraryGraphs | undefined;

  keypadRow: HTMLElement | undefined;

  focusedmq: MathQuillField | undefined;

  identTracker: IntellisenseState = new IntellisenseState(this.calc);

  searchStr: string = "";

  menuExpansionData: {
    graphs: Record<
      string,
      {
        expanded: boolean;
        folders: Record<
          string,
          {
            expanded: boolean;
          }
        >;
      }
    >;
  } = { graphs: {} };

  isGraphExpanded(link: string) {
    return this.menuExpansionData.graphs[link]?.expanded ?? false;
  }

  updateLocalStorage() {
    localStorage.setItem(
      EXPANSIONS_LOCALSTORAGE_KEY,
      JSON.stringify(this.menuExpansionData)
    );
  }

  toggleGraphExpanded(link: string) {
    if (!this.menuExpansionData.graphs[link]) {
      this.menuExpansionData.graphs[link] = { expanded: true, folders: {} };
    } else {
      this.menuExpansionData.graphs[link].expanded =
        !this.menuExpansionData.graphs[link].expanded;
    }
    this.updateLocalStorage();
    this.dsm.pillboxMenus?.updateMenuView();
  }

  isFolderExpanded(link: string, id: string) {
    return this.menuExpansionData.graphs[link]?.folders[id]?.expanded ?? false;
  }

  toggleFolderExpanded(link: string, id: string) {
    if (!this.menuExpansionData.graphs[link]) {
      this.menuExpansionData.graphs[link] = { expanded: true, folders: {} };
    }
    if (!this.menuExpansionData.graphs[link].folders[id]) {
      this.menuExpansionData.graphs[link].folders[id] = { expanded: true };
    } else {
      this.menuExpansionData.graphs[link].folders[id].expanded =
        !this.menuExpansionData.graphs[link].folders[id].expanded;
    }
    this.updateLocalStorage();
    this.dsm.pillboxMenus?.updateMenuView();
  }

  refineSearch(searchStr: string) {
    this.searchStr = searchStr;
    // this.controller.pillboxMenus?.updateExtraComponents();
    this.dsm.pillboxMenus?.updateMenuView();
  }

  view: MountedComponent | undefined;

  updateFocusedMathquill() {
    this.focusedmq = MathQuillView.getFocusedMathquill();
  }

  openSearch() {
    this.updateFocusedMathquill();
  }

  createEmptyFolder(title: string) {
    this.calc.controller.dispatch({ type: "new-folder" });

    const idx = this.calc.controller.getSelectedItem()?.index;
    if (idx !== undefined) {
      const folder = this.calc.controller.listModel.__itemModelArray[idx];
      if (folder.type === "folder") {
        folder.title = title;
      }
    }

    this.calc.controller.updateTheComputedWorld();
  }

  async loadFolder(expr: ExpressionLibraryFolder) {
    this.createEmptyFolder(expr.text);

    for (const id of expr.expressions) {
      const e = expr.graph.expressions.get(id);
      if (e && e.type === "expression") {
        await this.loadMathExpression(e);
      }
    }
  }

  getInsertionStartIndex() {
    return (
      this.calc.controller.listModel.__itemModelArray.findIndex(
        (e) => e.id === (this.calc.controller.getSelectedItem()?.id ?? "0")
      ) + 1
    );
  }

  async loadMathExpression(
    expr: ExpressionLibraryMathExpression,
    dontLoadDependencies?: boolean
  ) {
    this.focusedmq?.focus();
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

    let startIndex = this.getInsertionStartIndex();

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

  async loadEntireGraph(graph: ExpressionLibraryGraph) {
    this.createEmptyFolder(`Graph: ${graph.title}`);

    for (const [_, expr] of Array.from(graph.expressions.entries()).reverse()) {
      if (expr.type === "expression") {
        await this.loadMathExpression(expr, true);
      }
    }
  }

  async loadGraphs() {
    const graphs = (
      await Promise.all(
        this.settings.libraryGraphLinks
          .filter((s) => s)
          .map(async (s) => [s, await getGraphState(s)] as const)
      ).then((state) => {
        if (state.some((s) => !s[1])) {
          this.calc.controller._showToast({
            message: format("my-expressions-library-did-not-load", {
              links:
                "\n" +
                state
                  .filter((s) => !s[1])
                  .map((s) => `"${s[0]}"`)
                  .join("\n"),
            }),
          });
        }
        return state.map((s) => s[1]);
      })
    ).filter((g) => g);

    this.graphs = {
      graphs: [],
    };

    let uniqueID = 0;

    for (const g of graphs) {
      if (!g) continue;

      const newGraph: Partial<ExpressionLibraryGraph> = {};

      // maps ident names to expression ids.
      const dependencymap = new Map<string, string>();

      const augs = new Map<string, Aug.NonFolderAug>();

      const folders = new Map<string, ExpressionLibraryFolder>();

      for (const expr of g.state.expressions.list) {
        if (expr.type !== "folder") {
          augs.set(
            expr.id,
            rawNonFolderToAug(
              buildConfigFromGlobals(Desmos, this.calc),
              expr,
              getMetadata(this.calc)
            )
          );
        } else {
          folders.set(expr.id, {
            text: expr.title ?? "Untitled Folder",
            expressions: new Set(),
            type: "folder",
            uniqueID: uniqueID++,
            graph: newGraph as ExpressionLibraryGraph,
            id: expr.id,
          });
        }
      }

      for (const expr of g.state.expressions.list) {
        if (expr.type === "folder") continue;
        folders.get(expr.folderId ?? "")?.expressions?.add(expr.id);
      }

      for (const [id, aug] of augs) {
        if (aug.type === "expression" && aug.latex) {
          const root = aug.latex;
          if (root.type === "Assignment") {
            dependencymap.set(root.left.symbol, id);
          } else if (root.type === "FunctionDefinition") {
            dependencymap.set(root.symbol.symbol, id);
          }
        }
      }

      newGraph.expressions = new Map(
        (
          Array.from(folders.entries()) as [
            string,
            ExpressionLibraryExpression
          ][]
        ).concat(
          (
            g.state.expressions.list as (ItemState & {
              latex: string | undefined;
            })[]
          )
            .filter((e) => e.latex !== undefined)
            .map((e) => {
              const aug = augs.get(e.id);
              if (!aug) return undefined;

              const dependsOn = new Set<string>();

              forAllLatexSources(aug, (ltx) => {
                mapAugAST(ltx, (node) => {
                  if (node && node.type === "Identifier") {
                    const dep = dependencymap.get(node.symbol);
                    if (dep) {
                      dependsOn.add(dep);
                    }
                  }
                });
              });

              let textMode = "";

              try {
                textMode = astToText(
                  rootLatexToAST(
                    parseRootLatex(
                      buildConfigFromGlobals(Desmos, this.calc),
                      e.latex ?? ""
                    )
                  ),
                  {
                    noOptionalSpaces: true,
                    noNewlines: true,
                  }
                );
              } catch {}

              return [
                e.id,
                {
                  aug,
                  latex: e.latex,
                  textMode,
                  dependsOn,
                  uniqueID: uniqueID++,
                  graph: newGraph,
                  raw: e,
                  type: "expression",
                },
              ];
            })
            .filter((e) => e) as [string, ExpressionLibraryExpression][]
        )
      );

      for (const [k, v] of folders) {
        newGraph.expressions.set(k, v);
      }

      newGraph.link = g.link;
      newGraph.hash = g.hash;
      newGraph.uniqueID = uniqueID++;
      newGraph.title = g.title ?? "Untitled Graph";
      newGraph.type = "graph";

      this.graphs.graphs.push(newGraph as ExpressionLibraryGraph);
    }
    this.dsm.pillboxMenus?.updateMenuView();
  }

  getLibraryExpressions() {
    const exprs: ExpressionLibraryExpression[] = [];
    for (const graph of this.graphs?.graphs ?? []) {
      exprs.push(graph);
      for (const [_, expr] of graph.expressions) {
        if (expr.type === "expression") {
          if (
            expr.raw.type === "expression" &&
            (expr.raw.latex?.startsWith(
              (() => {
                let ltx =
                  textModeExprToLatex(
                    buildConfigFromGlobals(Desmos, this.calc),
                    this.searchStr
                  ) ?? "";
                if (ltx[ltx.length - 1] === "}") ltx = ltx?.slice(0, -1);
                return ltx;
              })() ?? ""
            ) ??
              true)
          )
            exprs.push(expr);
        } else if (expr.type === "folder") {
          if (expr.text.includes(this.searchStr)) exprs.push(expr);
        }
      }
    }
    return exprs;
  }

  async afterConfigChange() {
    void this.loadGraphs();
  }

  afterEnable(): void {
    // add pillbox menu
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-library-menu",
      tooltip: "my-expressions-library-pillbox-menu",
      iconClass: "dsm-icon-bookmark",
      popup: () => {
        return (
          <LibrarySearchView
            plugin={() => {
              return this;
            }}
          ></LibrarySearchView>
        );
      },
    });

    void this.loadGraphs();

    try {
      this.menuExpansionData = JSON.parse(
        localStorage.getItem(EXPANSIONS_LOCALSTORAGE_KEY) ?? "{ 'graphs': {} }"
      );
    } catch {}
  }

  afterDisable(): void {}
}
