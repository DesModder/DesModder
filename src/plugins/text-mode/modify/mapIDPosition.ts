import { ChangeSet } from "@codemirror/state";

export interface MapIDPosition {
  [key: string]: number;
}

export function applyChanges(map: MapIDPosition, changeSet: ChangeSet) {
  changeSet.iterChangedRanges((fromA, toA, fromB, toB) => {
    for (let key in map) {
      const pos = map[key];
      map[key] = pos >= toA ? toB - toA + pos : pos;
      if (pos > fromA && pos < fromB) {
        throw "Programming error: Change applied spanning an item";
      }
    }
  });
}
