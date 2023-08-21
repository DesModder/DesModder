/** This file runs before Desmos is loaded */
import { Replacer } from "../plugins/PluginController";
import { FacetNamesWithOutput } from "dataflow";

export function replaceElement<T>(old: () => T, replacer: () => Replacer<T>) {
  const DCGView = (Desmos as any).Private.Fragile.DCGView;
  return DCGView.Components.IfElse(() => !!replacer(), {
    true: () => replacer()!(old()),
    false: () => old(),
  });
}

export type Inserter<ExtraOpts = undefined> = (extraOpts: ExtraOpts) => any;

export function insertFacetElement<ExtraOpts = undefined>(
  facet: FacetNamesWithOutput<Inserter<ExtraOpts>>,
  extraOpts?: () => ExtraOpts
) {
  const DCGView = (Desmos as any).Private.Fragile.DCGView;
  return DCGView.createElement(
    DCGView.Components.Switch,
    { key: () => (window as any).DSM.facet(facet) },
    (elem: any) => elem?.(extraOpts?.())
  );
}
