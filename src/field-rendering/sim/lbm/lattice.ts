/** The D2Q9 velocity set: rest, then E N W S, then NE NW SW SE. */

export const Q = 9;
export const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
export const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
export const W = [
  4 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
] as const;
export const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;
