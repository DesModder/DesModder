import MyExpressionsLibrary from ".";
import { ExpressionLibraryGraph } from "./library-statements";
import { buildConfigFromGlobals } from "../../../text-mode-core";
import { getMetadata } from "../manage-metadata/sync";
import { getGraphState, processGraph } from "./get-graph-state";

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
        // TODO-ml: metadata wrong
        const graph = await processGraph(
          state,
          () => this.plugin.uniqueID++,
          getMetadata(this.plugin.calc),
          buildConfigFromGlobals(Desmos, this.plugin.calc)
        );

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
