/** This file runs before Desmos is loaded */
import type { ComponentChild, ComponentConstructor, OrConst } from "../DCGView";
import { Replacer } from "../plugins/PluginController";

export function createElementWrapped<Props>(
  el: ComponentConstructor<Props>,
  props: OrConst<Props> & { children?: ComponentChild[] }
) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  const isChildrenOutsideProps =
    DCGView.createElement({}, {}, "third-arg").children === "third-arg";
  if (isChildrenOutsideProps) {
    const { children } = props;
    const childrenArr = !children
      ? []
      : Array.isArray(children)
        ? children
        : [children];
    // Old interface
    // TODO-remove-children-props
    return DCGView.createElement(el, props, ...childrenArr);
  }
  return DCGView.createElement(el, props as any);
}

export function insertElement(creator: () => undefined | (() => any)) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return createElementWrapped(DCGView.Components.If, {
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
  return createElementWrapped(DCGView.Components.Switch, {
    key,
    children: () => (replacer() ?? ((x) => x))(old()),
  } as any);
}
