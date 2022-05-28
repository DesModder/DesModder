interface FuncAny {
  (): any;
}

function _pollForValue<T>(func: () => T) {
  return new Promise<T>((resolve) => {
    const interval = setInterval(() => {
      const val = func();
      if (val !== null && val !== undefined) {
        clearInterval(interval);
        resolve(val);
      }
    }, 50);
  });
}

export async function pollForValue(func: FuncAny) {
  return await _pollForValue(func);
}

interface ClassDict {
  [key: string]: boolean;
}

export type MaybeClassDict = string | ClassDict | undefined | null;

function updateClass(out: ClassDict, c: MaybeClassDict) {
  // mutates `out`, returns nothing
  if (c == null) {
    // no change
  } else if (typeof c === "string") {
    for (const cls of c.split(" ")) {
      out[cls] = true;
    }
  } else {
    Object.assign(out, c);
  }
}

export function mergeClass(c1: MaybeClassDict, c2: MaybeClassDict) {
  const out: ClassDict = {};
  updateClass(out, c1);
  updateClass(out, c2);
  return out;
}

export type OptionalProperties<T> = {
  [K in keyof T]?: T[K];
};

export function mapFromEntries<K, V>(entries: Iterable<[K, V]>): Map<K, V> {
  let res = new Map();
  for (let [key, value] of entries) {
    res.set(key, value);
  }
  return res;
}
