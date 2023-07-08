import { Facet, StateField } from "@codemirror/state";

const voidFacet = Facet.define<unknown>();

export function onState<T>(field: StateField<T>, cb: (value: T) => void) {
  return voidFacet.compute([field], (state) => cb(state.field(field)));
}

export function onStateChange<T>(field: StateField<T>, cb: (value: T) => void) {
  // TODO-facet: skip-once is really just skipping non-userEvent
  return voidFacet.compute(
    [field],
    // skip once since this also applies to the initial value
    skipOnce((state) => cb(state.field(field)))
  );
}

export function skipOnce<T extends (...args: any[]) => void>(fn: T): T {
  let once = false;
  return ((...args) => {
    if (!once) once = true;
    else fn.apply(null, args);
  }) as T;
}
