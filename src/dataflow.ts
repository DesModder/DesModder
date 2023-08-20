import { Compartment, EditorState, Facet, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

const compartment = new Compartment();

/**
 * This Facets interface is intended to be extended through module
 * augmentation and interface merging, e.g.
 *
 *   declare module "dataflow" {
 *     interface Facets {
 *       exprActionButtons: {
 *         input: ActionButtonSpec;
 *         output: ActionButtonWithKey[];
 *       };
 *     }
 *   }
 *
 * By doing this, plugins do not depend on reference equality with each other
 * (allowing for external plugins), but we're typesafe within this main repo.
 */
export interface Facets {
  sink: {
    input: undefined;
    output: undefined;
  };
}

export type FacetNamesWithOutput<T> = {
  [K in keyof Facets]: Facets[K]["output"] extends T ? K : never;
}[keyof Facets];

/** Manage data flow between plugins. */
export class Dataflow {
  private readonly ev = new EditorView({
    state: EditorState.create({
      extensions: [compartment.of([])],
    }),
  });

  private readonly dfPlugins = new Map<string, DFPlugin>();
  private readonly facets = new Map<string, Facet<any, any>>();

  constructor() {
    this.addDFPlugin({
      id: "df-core",
      facets: facetsSpec({
        sink: {
          combine: () => undefined,
        },
      }),
      facetSources: {},
    });
  }

  addDFPlugin(pluginSpec: DFPluginSpec) {
    const plugin: DFPlugin = {
      id: pluginSpec.id,
      facets: Object.entries(pluginSpec.facets).map(([k, v]) => ({
        facetID: k,
        ...v,
      })),
      facetSources: Object.entries(pluginSpec.facetSources).map(([k, v]) =>
        hydrateFacetSource(k, v)
      ),
    };
    plugin.facets.push({
      facetID: `${pluginSpec.id}/enabled`,
      combine: () => true,
    });
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

  /** Warning: If you're currently inside a callback for computing a new facet
   * value, then .facet(id) will return the old facet value. If you're
   * in those callbacks, make sure to use the argument to compute(values). */
  facet<T extends keyof Facets>(facetID: T): Facets[T]["output"] | undefined;
  facet(facetID: string): unknown {
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
    const undefinedFacet = Facet.define<undefined, undefined>({
      combine: () => undefined,
    });
    const sources = [];
    for (const plugin of plugins) {
      // if (plugin.facetSources.length) console.log(plugin);
      for (const source of plugin.facetSources) {
        const field = this.facets.get(source.facetID);
        if (!field) continue;
        const prec = getPrecedence(source.precedence);
        const deps = source.deps.map((d) => {
          const facet = this.facets.get(d);
          if (!facet) return undefinedFacet;
          return facet;
        });
        const ext = field.compute(deps, (state) => {
          const obj: any = {};
          for (let i = 0; i < deps.length; i++) {
            obj[source.deps[i]] = state.facet(deps[i]);
          }
          return source.compute(obj);
        });
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

export interface DFPluginSpec {
  /** Plugin ID, such as "text-mode" */
  id: string;
  facets: FacetsSpec;
  facetSources: FacetSourcesSpec;
}

interface DFPlugin {
  id: string;
  facets: DFFacet<any, any>[];
  facetSources: FacetSource<any>[];
}

export type Precedence = "lowest" | "low" | "default" | "high" | "highest";

export interface FacetSource<Input> {
  facetID: string;
  precedence: Precedence;
  deps: readonly (keyof Facets)[];
  compute: (values: any) => Input;
}

interface FacetSourceBase {
  precedence?: Precedence;
}

interface FacetSourceConst<Value> extends FacetSourceBase {
  value: Value;
}

interface FacetSourceCompute<Value> extends FacetSourceBase {
  deps: readonly (keyof Facets)[];
  compute: (value: any) => Value;
}

type MapInput<Deps extends readonly (keyof Facets)[]> = {
  [Dep in Deps[number]]: Facets[Dep]["output"];
};

export function compute<Value, Deps extends readonly (keyof Facets)[]>(
  deps: Deps,
  compute: (value: MapInput<Deps>) => Value
): FacetSourceCompute<Value> {
  return { deps, compute };
}

type FacetSourceSpec<Value> =
  | FacetSourceConst<Value>
  | FacetSourceCompute<Value>;

function hydrateFacetSource(
  facetID: string,
  v: FacetSourceSpec<unknown>
): FacetSource<unknown> {
  const { deps, compute } =
    "value" in v ? { deps: [], compute: () => v.value } : v;
  return {
    precedence: v.precedence ?? "default",
    facetID,
    deps,
    compute: compute as (values: any[]) => unknown,
  };
}

export type FacetSourcesSpec = {
  [Key in keyof Facets]?: FacetSourceSpec<Facets[Key]["input"]>;
};

/** Identity function, used to trick Typescript into bidi type inference */
export function facetSourcesSpec(facetsSpec: FacetSourcesSpec) {
  return facetsSpec;
}

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type FacetsSpec = {
  [Key in keyof Facets]?: FacetSpec<
    Facets[Key]["input"],
    Facets[Key]["output"]
  >;
};

/** Identity function, used to trick Typescript into bidi type inference */
export function facetsSpec(facetsSpec: FacetsSpec) {
  return facetsSpec;
}

// Similar to FacetConfig from @codemirror/state.
interface FacetSpec<Input, Output> {
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

interface DFFacet<Input, Output> extends FacetSpec<Input, Output> {
  facetID: string;
}
