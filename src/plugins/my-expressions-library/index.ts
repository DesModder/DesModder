import Aug from "text-mode-core/aug/AugState";
import { parseRootLatex, rawNonFolderToAug } from "text-mode-core/aug/rawToAug";
import { textModeExprToLatex } from "text-mode-core/down/textToRaw";
import { getGraphState } from "./get-graph-state";
import { LibrarySearchViewFunc } from "./view";
import { ExpressionState, ItemState } from "../../../graph-state";
import { MathQuillField } from "#components";
import { PluginController } from "../PluginController";
import { mapAugAST } from "../intellisense/latex-parsing";
import { IntellisenseState } from "../intellisense/state";
import { getMetadata } from "../manage-metadata/sync";
import { astToText, buildConfigFromGlobals } from "text-mode-core";
import { rootLatexToAST } from "text-mode-core/up/augToAST";
import { GraphValidity, LazyLoadableGraph } from "./lazy-loadable-graph";

// represents an easily searchable math expression with dependency graphing
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

// folder representation
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
  | ExpressionLibraryFolder;

// internal representation of a loaded graph
export interface ExpressionLibraryGraph {
  // maps expression IDs to expressions
  expressions: Map<string, ExpressionLibraryExpression>;
  hash: string;
  link: string;
  uniqueID: number;
  type: "graph";
  title?: string;
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

// map over all latex sources for dependency tracking
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

// keys for local storage
export const EXPANSIONS_LOCALSTORAGE_KEY = "dsm-my-expr-lib-expansions";
export const LINK_TO_NAME_LOCALSTORAGE_KEY = "dsm-my-expr-lib-link2name";

// @ts-expect-error window can have anything on it
window.jsonEqual = jsonEqual;

export default class MyExpressionsLibrary extends PluginController<{
  libraryGraphLinks: string[]; // probably a temporary fix
}> {
  static id = "my-expressions-library" as const;
  static enabledByDefault = false;
  static config = [
    {
      type: "stringArray",
      default: [],
      key: "libraryGraphLinks",
      notInSettingsMenu: true,
    },
  ] as const;

  graphs = new Map<string, LazyLoadableGraph>();

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

  linkToName: Record<string, string> = {};

  // convert graph link to cached name
  getNameFromLink(link: string) {
    return this.linkToName[link];
  }

  // associate a link with a graph name
  setNameFromLink(link: string, name: string) {
    this.linkToName[link] = name;
    localStorage.setItem(
      LINK_TO_NAME_LOCALSTORAGE_KEY,
      JSON.stringify(this.linkToName)
    );
  }

  // is a graph expanded in the My Expressions Library menu?
  isGraphExpanded(link: string) {
    return this.menuExpansionData.graphs[link]?.expanded ?? false;
  }

  updateLocalStorage() {
    localStorage.setItem(
      EXPANSIONS_LOCALSTORAGE_KEY,
      JSON.stringify(this.menuExpansionData)
    );
  }

  // toggle whether a graph is expanded in the MyExprLib menu
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

  // is a folder expanded in the menu?
  isFolderExpanded(link: string, id: string) {
    return this.menuExpansionData.graphs[link]?.folders[id]?.expanded ?? false;
  }

  // toggle whether a folder's expanded in the MyExprLib menu
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

  // change the search string
  refineSearch(searchStr: string) {
    this.searchStr = searchStr;
    // this.controller.pillboxMenus?.updateExtraComponents();
    this.dsm.pillboxMenus?.updateMenuView();
  }

  // create an empty folder after the currently selected expression
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

  // load all the contents of a folder into the current graph
  async loadFolder(expr: ExpressionLibraryFolder) {
    this.createEmptyFolder(expr.text);

    for (const id of expr.expressions) {
      const e = expr.graph.expressions.get(id);
      if (e && e.type === "expression") {
        await this.loadMathExpression(e);
      }
    }
  }

  // index of selected item
  getInsertionStartIndex() {
    return (this.calc.controller.getSelectedItem()?.index ?? 0) + 1;
  }

  // add a single math expression into the graph
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

  // load an entire graph into this graph
  async loadEntireGraph(graph: ExpressionLibraryGraph) {
    this.createEmptyFolder(`Graph: ${graph.title}`);

    for (const [_, expr] of Array.from(graph.expressions.entries()).reverse()) {
      if (expr.type === "expression") {
        await this.loadMathExpression(expr, true);
      }
    }
  }

  uniqueID = 0;

  // convert the data returned from a raw graph fetch request into an ExpressionLibraryGraph
  async getGraph(
    g: Exclude<Awaited<ReturnType<typeof getGraphState>>, undefined>
  ) {
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
          uniqueID: this.uniqueID++,
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
        Array.from(folders.entries()) as [string, ExpressionLibraryExpression][]
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
                uniqueID: this.uniqueID++,
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
    newGraph.uniqueID = this.uniqueID++;
    newGraph.title = g.title ?? "Untitled Graph";
    newGraph.type = "graph";
    return newGraph as ExpressionLibraryGraph;
  }

  // get all expressions from all loaded graphs
  // this function also prompts all graphs to be force-loaded
  getLibraryExpressions() {
    // force load all graphs to enable searching
    for (const graph of this.graphs.values()) {
      if (!!graph.data || graph.valid === GraphValidity.Invalid) continue;
      void graph.load().then(() => {
        this.updateViews();
      });
    }

    const exprs: ExpressionLibraryExpression[] = [];
    for (const graphData of this.graphs.values()) {
      const graph = graphData.data;

      if (!graph) continue;

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
    const links = new Set(this.settings.libraryGraphLinks);

    for (const link of [...this.graphs.keys()]) {
      if (!links.has(link)) this.graphs.delete(link);
    }

    for (const link of links) {
      this.tryToAddNewGraph(link, true);
    }
  }

  updateViews() {
    this.dsm.pillboxMenus?.updateMenuView();
  }

  tryToAddNewGraph(link: string, forceLoad?: boolean) {
    if (this.graphs.has(link)) return;

    const llg = new LazyLoadableGraph({
      link,
      name: this.getNameFromLink(link),
      plugin: this,
    });
    this.graphs.set(link, llg);

    if (!llg.name || forceLoad) {
      void llg.load().then(() => {
        this.updateViews();
      });
    }
  }

  afterEnable(): void {
    try {
      this.menuExpansionData = JSON.parse(
        localStorage.getItem(EXPANSIONS_LOCALSTORAGE_KEY) ?? "{ 'graphs': {} }"
      );
      this.linkToName = JSON.parse(
        localStorage.getItem(LINK_TO_NAME_LOCALSTORAGE_KEY) ?? "{}"
      );
    } catch {}

    const linksOfExpanded = new Set<string>();

    for (const [k, v] of Object.entries(this.menuExpansionData.graphs)) {
      if (v.expanded) {
        linksOfExpanded.add(k);
      }
    }

    for (const link of this.settings.libraryGraphLinks) {
      this.tryToAddNewGraph(link, linksOfExpanded.has(link));
    }

    // add pillbox menu
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-library-menu",
      tooltip: "my-expressions-library-pillbox-menu",
      iconClass: "dsm-icon-bookmark",
      popup: () => {
        return LibrarySearchViewFunc(this);
      },
    });
  }

  afterDisable(): void {
    this.dsm.pillboxMenus?.removePillboxButton("dsm-library-menu");
  }
}
