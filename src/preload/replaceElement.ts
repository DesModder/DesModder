/** This file runs before Desmos is loaded */
import type { ComponentChild, ComponentConstructor, OrConst } from "../DCGView";
import { Replacer } from "../plugins/PluginController";

export function createElementWrapped<Props>(
  el: ComponentConstructor<Props>,
  props: OrConst<Props> & { children?: ComponentChild[] }
) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return DCGView.createElement(el, props as any);
}

export function insertElement(creator: () => undefined | (() => any)) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return DCGView.createElement(DCGView.Components.If, {
    predicate: () => !!creator(),
    children: () => creator()!(),
  } as any);
}

export function replaceElement<T>(
  old: () => T,
  replacer: () => Replacer<T>,
  key: () => unknown = () => !!replacer()
) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return DCGView.createElement(DCGView.Components.Switch, {
    key,
    children: () => (replacer() ?? ((x) => x))(old()),
  } as any);
}
