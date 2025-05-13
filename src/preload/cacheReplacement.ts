import { fullReplacement } from "../../apply-replacements/applyReplacement";
import { Block } from "../../apply-replacements/parse";
import { IDBPDatabase, openDB, deleteDB } from "idb";
import { Console } from "../globals";

const CACHE_STORE = "replacement_store";
const CACHE_KEY = "replacement_cached";

interface ReplacementOpts {
  addPanic: (b: Block) => void;
  /**
  /*
  * The replacement functions doesn't actually append the `workerAppend` string,
  * it just uses it for a cache key. The function does add a `${window.dsm_workerAppend}`
  * in the worker string, so the expectation is that `window.dsm_workerAppend` is
  * set on the window before the new worker string is evaluated.
  */
  workerAppend: string;
}

// We used to use idb-keyval, which forced a particular db name and schema.
// Deleting it saves about 7MB of disk.
async function deleteOldDB() {
  try {
    await deleteDB("keyval-store");
  } catch {}
}

/**
 * Replacements are slow, so we cache the result. We optimize for the common
 * case of having one fixed calculator_desktop loaded several times, then
 * never used again once the next release rolls out.
 */
export async function fullReplacementCached(
  calcDesktop: string,
  enabledReplacements: Block[],
  replOpts: ReplacementOpts
): Promise<string> {
  void deleteOldDB();
  const db = await openDB("cached-replacement-store", 1, {
    upgrade(db) {
      db.createObjectStore(CACHE_STORE);
    },
  });
  const cached = await getCache(db);
  const hashRepls = cyrb53(JSON.stringify(enabledReplacements));
  const hashFile = cyrb53(calcDesktop);
  const hashAppend = cyrb53(replOpts.workerAppend);
  if (
    cached !== undefined &&
    cached.hashRepls === hashRepls &&
    cached.hashFile === hashFile &&
    cached.hashAppend === hashAppend
  ) {
    // cache hit :)
    return cached.result;
  }
  // cache miss :(
  let good = true;
  const result = fullReplacement(calcDesktop, enabledReplacements);
  for (const e of result.otherErrors) {
    good = false;
    Console.warn(e);
  }
  for (const [b, e] of result.blockFailures) {
    good = false;
    Console.warn(e);
    replOpts.addPanic(b);
  }
  // cache if there's no panics
  if (good)
    void setCache(db, {
      hashRepls,
      hashFile,
      hashAppend,
      result: result.newCode,
    });
  return result.newCode;
}

interface Cached {
  hashRepls: number;
  hashFile: number;
  hashAppend: number;
  result: string;
}

async function getCache(db: IDBPDatabase): Promise<Cached | undefined> {
  try {
    return await db.get(CACHE_STORE, CACHE_KEY);
  } catch {
    return undefined;
  }
}

async function setCache(db: IDBPDatabase, obj: Cached) {
  try {
    // It's value and then key. Weird.
    await db.put(CACHE_STORE, obj, CACHE_KEY);
  } catch {
    Console.warn(
      "Failed to cache replacement. This is expected in a Private Window " +
        "but could indicate a problem in a regular window"
    );
  }
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
