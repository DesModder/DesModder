import { Console } from "../../globals/window";
import { addPanic, panickedPlugins } from "../../panic/panic";
import workerAppend from "./append.inline";
import { ReplacementResult, applyReplacements } from "./applyReplacement";
import { Block } from "./parse";
import { IDBPDatabase, openDB } from "idb";
import jsTokens from "js-tokens";

const CACHE_STORE = "replacement_store";
const CACHE_KEY = "replacement_cached";

/**
 * Replacements are slow, so we cache the result. We optimize for the common
 * case of having one fixed calculator_desktop loaded several times, then
 * never used again once the next release rolls out.
 */
export async function fullReplacementCached(
  calcDesktop: string,
  enabledReplacements: Block[]
): Promise<string> {
  (window as any).dsm_workerAppend = workerAppend;
  const db = await openDB("cached-replacement-store", 1, {
    upgrade(db) {
      db.createObjectStore(CACHE_STORE);
    },
  });
  const cached = await getCache(db);
  const hashRepls = cyrb53(JSON.stringify(enabledReplacements));
  const hashFile = cyrb53(calcDesktop);
  const hashAppend = cyrb53(workerAppend);
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
  const result = fullReplacement(calcDesktop, enabledReplacements);
  // cache if there's no panics
  if (panickedPlugins.size === 0)
    void setCache(db, { hashRepls, hashFile, hashAppend, result });
  return result;
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

function fullReplacement(calcDesktop: string, enabledReplacements: Block[]) {
  const tokens = Array.from(jsTokens(calcDesktop));
  const sharedModuleTokens = tokens.filter(
    (x) =>
      x.type === "StringLiteral" &&
      x.value.length > 200000 &&
      // JS is sure to have &&. Protects against translations getting longer
      // than the length cutoff, which is intentionally low in case of huge
      // improvements in minification.
      x.value.includes("&&")
  );
  let workerResult: ReplacementResult;
  if (sharedModuleTokens.length !== 1) {
    Console.warn(
      "More than one large JS string found, which is the shared module?"
    );
    // no-op
    workerResult = {
      successful: new Set(),
      failed: new Map(
        enabledReplacements.map(
          (b) =>
            [b, `Not reached: ${b.heading}. Maybe no worker builder?`] as const
        )
      ),
      value: calcDesktop,
    };
  } else {
    const sharedModuleToken = sharedModuleTokens[0];
    workerResult = applyReplacements(
      enabledReplacements.filter((x) => x.workerOnly),
      // JSON.parse doesn't work because this is a single-quoted string.
      // js-tokens tokenized this as a string anyway, so it should be
      // safely eval'able to a string.
      // eslint-disable-next-line no-eval
      (0, eval)(sharedModuleToken.value) as string
    );
    sharedModuleToken.value = JSON.stringify(workerResult.value);
  }
  const wbTokenHead = tokens.find(
    (x) =>
      x.type === "NoSubstitutionTemplate" &&
      x.value.includes("const __dcg_worker_module__ =")
  );
  const wbTokenTail = tokens.find(
    (x) =>
      x.type === "TemplateTail" &&
      x.value.includes(
        "__dcg_worker_module__(__dcg_worker_shared_module_exports__);"
      )
  );
  if (wbTokenTail === undefined || wbTokenHead === undefined) {
    Console.warn("Failed to find valid worker builder.");
  } else {
    wbTokenHead.value =
      // eslint-disable-next-line no-template-curly-in-string
      "`function loadDesModderWorker(){${window.dsm_workerAppend}}" +
      wbTokenHead.value.slice(1);
    wbTokenTail.value =
      wbTokenTail.value.slice(0, -1) + "\n loadDesModderWorker();`";
  }
  const srcWithWorkerAppend = tokens.map((x) => x.value).join("");
  const mainResult = applyReplacements(
    enabledReplacements.filter((x) => !x.workerOnly),
    srcWithWorkerAppend
  );
  const failed = [...workerResult.failed].concat([...mainResult.failed]);

  for (const [b, e] of failed) {
    Console.warn(e);
    addPanic(b);
  }
  return mainResult.value;
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
