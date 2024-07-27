import { textModeExprToLatex } from "text-mode-core/down/textToRaw";
import { LibrarySearchViewFunc } from "./view";
import { PluginController } from "../PluginController";
import { IntellisenseState } from "../intellisense/state";
import { buildConfigFromGlobals } from "text-mode-core";
import { GraphValidity, LazyLoadableGraph } from "./lazy-loadable-graph";
import {
  ExpressionLibraryExpression,
  ExpressionLibraryFolder,
  ExpressionLibraryMathExpression,
} from "./library-statements";
import { Inserter } from "./insertion";
import { AllActions, DispatchedEvent } from "../../globals/extra-actions";
import { format } from "#i18n";

declare module "src/globals/extra-actions" {
  interface AllActions {
    "my-library":
      | {
          type: "dsm-my-library-toggle-folder-expanded";
          link: string;
          id: string;
        }
      | {
          type: "dsm-my-library-insert-folder";
          // TODO-ml: This should just be link and id
          expr: ExpressionLibraryFolder;
        }
      | {
          type: "dsm-my-library-insert-math";
          // TODO-ml: This should just be link and id
          expr: ExpressionLibraryMathExpression;
        }
      | {
          type:
            | "dsm-my-library-toggle-graph-expanded"
            | "dsm-my-library-remove-graph"
            | "dsm-my-library-add-graph"
            | "dsm-my-expr-lib-insert-entire-graph";
          link: string;
        };
  }
}

// keys for local storage
export const EXPANSIONS_LOCALSTORAGE_KEY = "dsm-my-expr-lib-expansions";
export const LINK_TO_NAME_LOCALSTORAGE_KEY = "dsm-my-expr-lib-link2name";

export class MyLibrary extends PluginController<{
  libraryGraphLinks: string[]; // probably a temporary fix
}> {
  static id = "my-library" as const;
  static enabledByDefault = false;
  static config = [
    {
      type: "stringArray",
      default: [],
      key: "libraryGraphLinks",
      notInSettingsMenu: true,
    },
  ] as const;

  /** Map from graph link to graph */
  graphs = new Map<string, LazyLoadableGraph>();

  keypadRow: HTMLElement | undefined;

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

  inserter: Inserter = new Inserter(this.calc);

  handleDispatchedAction(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-my-expr-lib-insert-entire-graph":
        // TODO-ml: make this non-async
        this.cc.runAfterDispatch(() => {
          void this.loadEntireGraph(action.link);
        });
        break;
      case "dsm-my-library-insert-folder":
        // TODO-ml: make this non-async
        this.cc.runAfterDispatch(() => {
          void this.loadFolder(action.expr);
        });
        break;
      case "dsm-my-library-insert-math":
        // TODO-ml: make this non-async
        this.cc.runAfterDispatch(() => {
          void this.loadMathExpression(action.expr);
        });
        break;
      case "dsm-my-library-toggle-graph-expanded": {
        // TODO-ml: make this non-async
        this.cc.runAfterDispatch(() => {
          void this.toggleGraphExpanded(action.link);
        });
        break;
      }
      case "dsm-my-library-toggle-folder-expanded":
        this.toggleFolderExpanded(action.link, action.id);
        break;
      case "dsm-my-library-remove-graph": {
        const graph = this.graphs.get(action.link);
        if (!graph) return;
        this.dsm.setPluginSetting(
          "my-library",
          "libraryGraphLinks",
          this.settings.libraryGraphLinks.filter((l) => l !== action.link)
        );

        // TODO-ml: Add an undo button (quite important after deleting a graph).
        this.cc._showToast({
          // This use of `format` is okay because `_showToast` is ephemeral.
          // eslint-disable-next-line rulesdir/no-format-in-ts
          message: format("my-library-remove-graph-success", {
            link: action.link,
            name: graph.name ?? "Untitled Graph",
          }),
          hideAfter: 0,
        });
        break;
      }
      case "dsm-my-library-add-graph": {
        // TODO-ml: Add an undo button (may as well since we're toasting anyways).
        if (this.settings.libraryGraphLinks.includes(action.link)) {
          this.cc._showToast({
            // This use of `format` is okay because `_showToast` is ephemeral.
            // eslint-disable-next-line rulesdir/no-format-in-ts
            message: format("my-library-add-graph-duplicate", {
              link: action.link,
              name: this.graphs?.get(action.link)?.name ?? "Untitled Graph",
            }),
            hideAfter: 0,
          });
          return;
        }
        this.dsm.setPluginSetting(
          "my-library",
          "libraryGraphLinks",
          this.settings.libraryGraphLinks.concat(action.link)
        );
        this.cc._showToast({
          // This use of `format` is okay because `_showToast` is ephemeral.
          // eslint-disable-next-line rulesdir/no-format-in-ts
          message: format("my-library-add-graph-success", {
            link: action.link,
          }),
          hideAfter: 0,
        });
        break;
      }
      default:
        action satisfies Exclude<DispatchedEvent, AllActions["my-library"]>;
    }
    return undefined;
  }

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
  async toggleGraphExpanded(link: string) {
    // TODO-ml: loading indicator?
    const lazyGraph = this.graphs.get(link);
    if (!lazyGraph) return;
    if (!this.isGraphExpanded(link)) {
      await lazyGraph.load();
    }
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

  // index of selected item
  getInsertionStartIndex(): number {
    return (this.calc.controller.getSelectedItem()?.index ?? 0) + 1;
  }

  async loadEntireGraph(link: string) {
    const graph = await this.graphs.get(link)?.load();
    if (!graph) return;
    const startIndex = this.getInsertionStartIndex();
    await this.inserter.loadEntireGraph(graph, startIndex);
  }

  async loadFolder(expr: ExpressionLibraryFolder) {
    const startIndex = this.getInsertionStartIndex();
    await this.inserter.loadFolder(expr, startIndex);
  }

  async loadMathExpression(
    expr: ExpressionLibraryMathExpression,
    dontLoadDependencies = false
  ) {
    const startIndex = this.getInsertionStartIndex();
    await this.inserter.loadMathExpression(
      expr,
      startIndex,
      dontLoadDependencies
    );
  }

  uniqueID = 0;

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
      ml: this,
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
      tooltip: "my-library-pillbox-menu",
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
