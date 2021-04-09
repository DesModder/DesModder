// Plugins should not access any modules besides this
// To expose more, submit a DesModder PR

// This file serves three purposes:
//  1. consolidate public modules/variables so plugins can simply
//       import { ... } from 'desmodder'
//  2. share common code between plugins, such as components and utilities
//  3. serve as a wrapper layer in case Desmos changes;

export * from 'components/desmosComponents'
export {
  Calc,
  // Try to avoid using desmosRequire in plugin code
  // (especially for modules that are likely to be used in other plugins)
  // Prefer exposing more in desmodder.ts
  desmosRequire,
  default as window
} from 'globals/window'
export { default as Toggle } from 'components/Toggle'
export { default as SmallMathQuillInput } from 'components/SmallMathQuillInput'
export { default as SegmentedControl } from 'components/SegmentedControl'
export { default as StaticMathQuillView } from 'components/StaticMathQuillView'
export {
  LooseProps,
  Props,
  MountedComponent,
  default as DCGView
} from 'DCGView'
export {
  pollForValue,
  jquery,
  keys
} from 'utils'
