/** This file runs before Desmos is loaded */
import { FacetNamesWithOutput } from "dataflow";

export type Replacer<ExtraOpts = undefined> = (
  old: () => any,
  extraOpts: ExtraOpts
) => any;

export function replaceFacetElement<ExtraOpts = undefined>(
  old: () => any,
  facet: FacetNamesWithOutput<Replacer<ExtraOpts>>,
  extraOpts?: () => ExtraOpts
) {
  const DCGView = (Desmos as any).Private.Fragile.DCGView;
  return DCGView.createElement(
    DCGView.Components.Switch,
    { key: () => (window as any).DSM.facet(facet) },
    (replacer: any) => (replacer ? replacer(old, extraOpts?.()) : old())
  );
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
