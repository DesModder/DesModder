import MyExpressionsLibrary, { ExpressionLibraryGraph } from ".";
import { getGraphState } from "./library-search-utils";

export enum GraphValidity {
  Valid = "valid",
  Invalid = "invalid",
  Unknown = "unknown",
}

export class LazyLoadableGraph {
  loading: boolean = false;
  valid: GraphValidity = GraphValidity.Unknown;
  data?: ExpressionLibraryGraph;
  name?: string;
  link: string;
  id: number;
  plugin: MyExpressionsLibrary;

  static CurrentID = 0;

  constructor(opts: {
    link: string;
    name?: string;
    plugin: MyExpressionsLibrary;
  }) {
    this.link = opts.link;
    this.plugin = opts.plugin;
    this.id = LazyLoadableGraph.CurrentID++;
    if (opts.name) {
      this.name = opts.name;
    }
  }

  setGraphInvalid() {
    this.loading = false;
    this.valid = GraphValidity.Invalid;
    this.data = undefined;
  }

  // attempt to fetch a graph from some server
  async load() {
    if (this.data) return this.data;

    this.loading = true;

    const state = await getGraphState(this.link, this.plugin);

    if (state) {
      try {
        const graph = await this.plugin.getGraph(state);
        this.loading = false;
        this.data = graph;
        this.name = graph.title ?? "Untitled Graph";
        this.plugin.setNameFromLink(this.link, this.name);
        this.valid = GraphValidity.Valid;
        return graph;
      } catch {
        this.setGraphInvalid();
      }
    } else {
      this.setGraphInvalid();
    }
  }
}
