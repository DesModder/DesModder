import { applyReplacements } from "./applyReplacement";
import { Block } from "./parse";
import { get, set } from "idb-keyval";

/**
 * Replacements are slow, so we cache the result. We optimize for the common
 * case of having one fixed calculator_desktop loaded several times, then
 * never used again once the next release rolls out.
 */
export async function applyReplacementsCached(
  repls: Block[],
  file: string,
  key: "worker" | "main"
): Promise<string> {
  const k = "replacement_cached_" + key;
  const cached = await get(k);
  const hashRepls = cyrb53(JSON.stringify(repls));
  const hashFile = cyrb53(file);
  if (
    cached !== undefined &&
    cached.hashRepls === hashRepls &&
    cached.hashFile === hashFile
  ) {
    // cache hit :)
    return cached.result;
  }
  // cache miss :(
  const result = applyReplacements(repls, file);
  void set(k, {
    hashRepls,
    hashFile,
    result,
  });
  return result;
}

// https://github.com/bryc/code/blob/fed42df9db547493452e32375c93d7854383e480/jshash/experimental/cyrb53.js
/*
    cyrb53 (c) 2018 bryc (github.com/bryc)
    A fast and simple hash function with decent collision resistance.
    Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
    Public domain. Attribution appreciated.
*/
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
