import { panickedPlugins } from "../../panic/panic";
import workerAppend from "../../worker/append.inline";
import { applyReplacements } from "./applyReplacement";
import { Block } from "./parse";
import { get, set } from "idb-keyval";
import jsTokens, { Token } from "js-tokens";

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
  const k = "replacement_cached";
  const cached = await get(k);
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
    void set(k, {
      hashRepls,
      hashFile,
      hashAppend,
      result,
    });
  return result;
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
  if (sharedModuleTokens.length !== 1) {
    throw new Error(
      "More than one large JS string found, which is the shared module?"
    );
  }
  let sharedModuleToken = sharedModuleTokens[0];
  const newSharedModule = applyReplacements(
    enabledReplacements,
    (0, eval)(sharedModuleToken.value) as string
  );
  sharedModuleToken.value = JSON.stringify(newSharedModule);
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
  if (wbTokenTail === undefined || wbTokenHead === undefined)
    throw new Error("Failed to find valid worker builder.");
  wbTokenHead.value =
    // eslint-disable-next-line no-template-curly-in-string
    "`function loadDesModderWorker(){${window.dsm_workerAppend}}" +
    wbTokenHead.value.slice(1);
  wbTokenTail.value =
    wbTokenTail.value.slice(0, -1) + "\n loadDesModderWorker();`";
  const srcWithWorkerAppend = tokens.map((x) => x.value).join("");
  return applyReplacements(enabledReplacements, srcWithWorkerAppend);
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
