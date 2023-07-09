/** This file runs before Desmos is loaded */
import { Replacer } from "../plugins/CMPlugin";

export function insertElement(creator: () => undefined | (() => any)) {
  const DCGView = (Desmos as any).Private.Fragile.DCGView;
  return DCGView.createElement(
    DCGView.Components.If,
    { predicate: () => !!creator() },
    () => creator()!()
  );
}

export function replaceElement<T>(old: () => T, replacer: () => Replacer<T>) {
  const DCGView = (Desmos as any).Private.Fragile.DCGView;
  return DCGView.Components.IfElse(() => !!replacer(), {
    true: () => replacer()!(old()),
    false: () => old(),
  });
}
