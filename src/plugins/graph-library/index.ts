import { PluginController } from "../PluginController";
import { DispatchedEvent } from "../../globals/extra-actions";
import { LibraryPanelFunc } from "./components/LibraryPanel";
import "./graph-library.less";

export interface GraphLibraryEntry {
  id: string;
  title: string;
  url: string;
  savedAt: number;
  calculatorType: "graphing" | "geometry" | "3d" | "unknown";
}

declare module "src/globals/extra-actions" {
  interface AllActions {
    "graph-library": {
      type:
        | "dsm-graph-library-save"
        | "dsm-graph-library-import"
        | "dsm-graph-library-delete"
        | "dsm-graph-library-open";
      id?: string;
      url?: string;
    };
  }
}

export default class GraphLibrary extends PluginController {
  static id = "graph-library" as const;
  static enabledByDefault = true;

  library: GraphLibraryEntry[] = [];
  copiedEntryId: string | null = null;

  afterEnable() {
    this.loadLibraryFromStorage();
    this.dsm.pillboxMenus?.addPillboxButton({
      id: "dsm-graph-library-menu",
      tooltip: "graph-library-name",
      iconClass: "dsm-icon-bookmark",
      popup: () => LibraryPanelFunc(this),
    });
  }

  afterDisable() {
    this.dsm.pillboxMenus?.removePillboxButton("dsm-graph-library-menu");
  }

  handleDispatchedAction(action: DispatchedEvent) {
    switch (action.type) {
      case "dsm-graph-library-save":
        this.saveCurrentGraph();
        break;
      case "dsm-graph-library-import":
        if (action.id) {
          this.importGraph(action.id);
        }
        break;
      case "dsm-graph-library-delete":
        if (action.id) {
          this.deleteFromLibrary(action.id);
        }
        break;
      case "dsm-graph-library-open":
        if (action.url) {
          window.open(action.url, "_blank");
        }
        break;
      default:
        action satisfies Exclude<DispatchedEvent, AllActions["graph-library"]>;
    }
    return undefined;
  }

  isInSavedGraph(): boolean {
    const url = window.location.href;
    // Check if URL has a graph ID after desmos.com/calculator/ (or geometry, 3d, etc.)
    // Pattern: desmos.com/{calculatorType}/{graphId}
    return /desmos\.com\/[^/]+\/[a-zA-Z0-9]+/.test(url);
  }

  isCurrentGraphSaved(): boolean {
    if (!this.isInSavedGraph()) return false;
    const currentUrl = this.getCurrentGraphUrl();
    return this.library.some((entry) => entry.url === currentUrl);
  }

  canSaveCurrentGraph(): boolean {
    return this.isInSavedGraph() && !this.isCurrentGraphSaved();
  }

  getCurrentGraphUrl(): string {
    return window.location.href.split("?")[0].split("#")[0]; // Remove query params and hash
  }

  getCalculatorTypeFromUrl(url: string): "graphing" | "geometry" | "3d" | "unknown" {
    if (url.includes("/calculator/")) return "graphing";
    if (url.includes("/geometry/")) return "geometry";
    if (url.includes("/3d/")) return "3d";
    return "unknown";
  }

  getCurrentGraphTitle(): string {
    try {
      // Try getting title from internal API first
      const title =
        this.calc._calc.globalHotkeys.mygraphsController.graphsController.getCurrentGraphTitle();
      if (title) return title;
    } catch {
      // API failed, fall through to DOM method
    }

    // Fallback to DOM element
    const titleElement = document.getElementById("dcg-graph-title-text");
    if (titleElement && titleElement.textContent) {
      const domTitle = titleElement.textContent.trim();
      if (domTitle) return domTitle;
    }

    return "Untitled Graph";
  }

  saveCurrentGraph() {
    if (!this.isInSavedGraph()) {
      return; // Silently fail if not in a saved graph
    }

    const url = this.getCurrentGraphUrl();
    const title = this.getCurrentGraphTitle();

    // Check if already saved
    if (this.library.some((entry) => entry.url === url)) {
      return; // Silently fail if already saved
    }

    const entry: GraphLibraryEntry = {
      id: crypto.randomUUID(),
      title,
      url,
      savedAt: Date.now(),
      calculatorType: this.getCalculatorTypeFromUrl(url),
    };

    this.library.push(entry);
    this.saveLibraryToStorage();

    // Update the view to show the new state
    this.dsm.pillboxMenus?.updateMenuView();
  }

  async importGraph(entryId: string) {
    const entry = this.library.find((e) => e.id === entryId);
    if (!entry) return;

    try {
      // Copy URL to clipboard
      await navigator.clipboard.writeText(entry.url);

      // Show copied state
      this.copiedEntryId = entryId;
      this.dsm.pillboxMenus?.updateMenuView();

      // Clear copied state after 2 seconds
      setTimeout(() => {
        this.copiedEntryId = null;
        this.dsm.pillboxMenus?.updateMenuView();
      }, 2000);
    } catch (err) {
      // Clipboard API failed
      console.error("Failed to copy to clipboard:", err);
    }
  }

  deleteFromLibrary(entryId: string) {
    const index = this.library.findIndex((e) => e.id === entryId);
    if (index === -1) return;

    this.library.splice(index, 1);
    this.saveLibraryToStorage();

    // Update the view to reflect the deletion
    this.dsm.pillboxMenus?.updateMenuView();
  }

  saveLibraryToStorage() {
    try {
      localStorage.setItem(
        "desmodder-graph-library",
        JSON.stringify(this.library)
      );
    } catch (err) {
      console.error("Failed to save graph library:", err);
    }
  }

  loadLibraryFromStorage() {
    try {
      const stored = localStorage.getItem("desmodder-graph-library");
      if (stored) {
        this.library = JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to load graph library:", err);
      this.library = [];
    }
  }

  libraryPanel(): Inserter {
    return () => LibraryPanelFunc(this);
  }
}
