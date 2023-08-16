import { Compartment, EditorState, Facet, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

const compartment = new Compartment();

/** Manage data flow between plugins. */
export class Dataflow {
  private readonly ev = new EditorView({
    state: EditorState.create({
      extensions: [compartment.of([])],
    }),
  });

  private readonly dfPlugins = new Map<string, DFPlugin>();
  private readonly facets = new Map<string, Facet<any, any>>();

  addDFPlugin(plugin: DFPlugin) {
    if (this.dfPlugins.has(plugin.id)) {
      throw new Error(`Dataflow Plugin '${plugin.id}' already present.`);
    }
    const duplicateFacets = plugin.facets.filter(({ facetID }) =>
      this.facets.has(facetID)
    );
    if (duplicateFacets.length > 0) {
      const msg = duplicateFacets.map((f) => `'${f.facetID}'`).join(", ");
      throw new Error(
        `Duplicate facet(s) when adding plugin '${plugin.id}': ${msg}`
      );
    }
    this.dfPlugins.set(plugin.id, plugin);
    this.afterPluginChange();
  }

  removeDFPlugin(id: string) {
    if (!this.dfPlugins.has(id)) {
      throw new Error(
        `Dataflow Plugin '${id}' is not present, cannot be removed.`
      );
    }
    this.dfPlugins.delete(id);
    this.afterPluginChange();
  }

  getFacetValue(facetID: string) {
    const field = this.facets.get(facetID);
    if (!field) return undefined;
    return this.ev.state.facet(field) as unknown;
  }

  private afterPluginChange() {
    // TODO: do this incrementally. CM's ViewPlugin may help. As can Compartment.
    this.facets.clear();
    const plugins = [...this.dfPlugins.keys()]
      .sort()
      .map((k) => this.dfPlugins.get(k)!);
    for (const plugin of plugins) {
      for (const facetSpec of plugin.facets) {
        if (this.facets.has(facetSpec.facetID))
          throw new Error(`Duplicate facet '${facetSpec.facetID}'`);
        const facet = Facet.define(facetSpec);
        this.facets.set(facetSpec.facetID, facet);
      }
    }
    const sources = [];
    for (const plugin of plugins) {
      for (const source of plugin.facetSources) {
        const field = this.facets.get(source.facetID);
        if (!field) continue;
        const prec = getPrecedence(source.precedence ?? "default");
        const ext = field.compute(source.deps, () => source.compute([]));
        sources.push(prec(ext));
      }
    }
    this.ev.dispatch({
      effects: [compartment.reconfigure(sources)],
    });
  }
}

function getPrecedence(prec: Precedence) {
  switch (prec) {
    case "lowest":
      return Prec.lowest;
    case "low":
      return Prec.low;
    case "default":
      return Prec.default;
    case "high":
      return Prec.high;
    case "highest":
      return Prec.highest;
    default:
      prec satisfies never;
      throw new Error(
        `Invalid prec: ${prec}. Must be one of: ` +
          `"lowest" | "low" | "default" | "high" | "highest"`
      );
  }
}

export interface DFPlugin {
  /** Plugin ID, such as "text-mode" */
  id: string;
  facets: DFFacet<any, any>[];
  facetSources: FacetSource[];
}

export type Precedence = "lowest" | "low" | "default" | "high" | "highest";

export interface FacetSource {
  facetID: string;
  precedence?: Precedence;
  deps: [];
  compute: (values: unknown[]) => any;
}

// Similar to FacetConfig from @codemirror/state.
export interface DFFacet<Input, Output> {
  facetID: string;
  /**
   * How to combine the input values into a single output value. When
   * not given, the array of input values becomes the output. This
   * function will immediately be called on creating the facet, with
   * an empty array, to compute the facet's default value when no
   * inputs are present.
   */
  combine?: (values: readonly Input[]) => Output;
  /**
   * How to compare output values to determine whether the value of
   * the facet changed. Defaults to comparing by `===` or, if no
   * `combine` function was given, comparing each element of the
   * array with `===`.
   */
  compare?: (a: Output, b: Output) => boolean;
  /**
   * How to compare input values to avoid recomputing the output
   * value when no inputs changed. Defaults to comparing with `===`.
   */
  compareInput?: (a: Input, b: Input) => boolean;
}
