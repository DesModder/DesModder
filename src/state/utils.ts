import { Facet, StateField } from "@codemirror/state";

const voidFacet = Facet.define<unknown>();

export function onStateChange<T>(field: StateField<T>, cb: (value: T) => void) {
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
