import { MyLibrary } from ".";
import { ExpressionLibraryGraph } from "./library-statements";
import { fetchAndProcessGraph } from "./get-graph-state";

export type LazyGraphState =
  | {
      /** Not yet fetched */
      type: "unknown";
    }
  | {
      /** Currently fetching */
      type: "fetching";
    }
  | {
      /** Fetched and failed, or invalid JSON. */
      type: "invalid";
    }
  | {
      type: "valid";
      graph: ExpressionLibraryGraph;
    };

export class LazyLoadableGraph {
  readonly id: number;
  readonly ml: MyLibrary;
  readonly link: string;

  state: LazyGraphState = { type: "unknown" };
  name?: string;

  static CurrentID = 0;

  constructor(opts: { link: string; name?: string; ml: MyLibrary }) {
    this.link = opts.link;
    this.ml = opts.ml;
    this.id = LazyLoadableGraph.CurrentID++;
    if (opts.name) {
      this.name = opts.name;
    }
  }

  /** Callbacks for concurrent requests on this same graph. */
  private resolves: ((g: ExpressionLibraryGraph | undefined) => void)[] = [];

  syncLoadOrUndefined() {
    const { state } = this;
    if (state.type === "valid") {
      return state.graph;
    }
    return undefined;
  }

  // attempt to fetch a graph from some server
  async load(): Promise<ExpressionLibraryGraph | undefined> {
    const { state } = this;
    switch (state.type) {
      case "unknown": {
        const graph = await this.fetch();
        return await new Promise((resolve) => {
          resolve(graph);
          for (const r of this.resolves) {
            r(graph);
          }
          this.resolves = [];
        });
      }
      case "fetching":
        return await new Promise((resolve) => {
          this.resolves.push(resolve);
        });
      case "invalid":
        return undefined;
      case "valid":
        return state.graph;
    }
  }

  private async fetch() {
    const graph = await fetchAndProcessGraph(this.link, this.ml);
    if (!graph) {
      this.state = { type: "invalid" };
      return undefined;
    }
    this.state = { type: "valid", graph };
    this.name = graph.title ?? "Untitled Graph";
    this.ml.setNameFromLink(this.link, this.name);
    return graph;
  }
}
