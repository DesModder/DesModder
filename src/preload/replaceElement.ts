/** This file runs before Desmos is loaded */
import { Replacer } from "../plugins/PluginController";

export function insertElement(creator: () => undefined | (() => any)) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return DCGView.createElement(
    DCGView.Components.If,
    { predicate: () => !!creator() },
    () => creator()!()
  );
}

export function replaceElement<T>(old: () => T, replacer: () => Replacer<T>) {
  const { DCGView } = (Desmos as any).Private.Fragile;
  return DCGView.Components.IfElse(() => !!replacer(), {
    true: () => replacer()!(old()),
    false: () => old(),
  });
}
