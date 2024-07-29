import { VanillaDispatchedEvent } from "./Calc";

/**
 * This AllActions interface is intended to be extended through module
 * augmentation and interface merging. See docs/dev/dispatch-handlers.md.
 */
export interface AllActions {
  vanilla: VanillaDispatchedEvent;
}

export type DispatchedEvent = AllActions[keyof AllActions];
