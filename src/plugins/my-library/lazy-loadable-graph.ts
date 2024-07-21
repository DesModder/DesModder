import { MyLibrary } from ".";
import { ExpressionLibraryGraph } from "./library-statements";
import { buildConfigFromGlobals } from "../../../text-mode-core";
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
  ml: MyLibrary;

  static CurrentID = 0;

  constructor(opts: { link: string; name?: string; ml: MyLibrary }) {
    this.link = opts.link;
    this.ml = opts.ml;
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

    const state = await getGraphState(this.link, this.ml);

    if (state) {
      try {
        const graph = await processGraph(
          state,
          () => this.ml.uniqueID++,
          buildConfigFromGlobals(Desmos, this.ml.calc)
        );

        this.loading = false;
        this.data = graph;
        this.name = graph.title ?? "Untitled Graph";
        this.ml.setNameFromLink(this.link, this.name);
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
