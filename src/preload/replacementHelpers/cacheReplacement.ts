import { existingPanics } from "../../panic/panic";
import { applyReplacements } from "./applyReplacement";
import { Block } from "./parse";
import { get, set } from "idb-keyval";
import jsTokens from "js-tokens";

/**
 * Replacements are slow, so we cache the result. We optimize for the common
 * case of having one fixed calculator_desktop loaded several times, then
 * never used again once the next release rolls out.
 */
export async function fullReplacementCached(
  calcDesktop: string,
  workerAppend: string,
  enabledReplacements: Block[]
): Promise<string> {
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
  const result = fullReplacement(
    calcDesktop,
    workerAppend,
    enabledReplacements
  );
  // cache if there's no panics
  if (existingPanics.size === 0)
    void set(k, {
      hashRepls,
      hashFile,
      hashAppend,
      result,
    });
  return result;
}

function fullReplacement(
  calcDesktop: string,
  workerAppend: string,
  enabledReplacements: Block[]
) {
  const newCode = applyReplacements(
    enabledReplacements.filter((r) => !r.workerOnly),
    calcDesktop
  );
  return applyWorkerReplacements(newCode, workerAppend, enabledReplacements);
}

function applyWorkerReplacements(
  src: string,
  workerAppend: string,
  enabledReplacements: Block[]
): string {
  // Apply replacements to the worker. This could also be done by tweaking the
  // Worker constructor, but currently all of these replacements could be
  // performed outside the main page
  const tokens = Array.from(jsTokens(src));
  const workerCodeTokens = tokens.filter(
    (x) =>
      x.type === "StringLiteral" &&
      x.value.length > 200000 &&
      // JS is sure to have &&. Protects against translations getting longer
      // than the length cutoff, which is intentionally low in case of huge
      // improvements in minification.
      x.value.includes("&&")
  );
  if (workerCodeTokens.length === 0) {
    // post-esbuild
    const wbTokenHead = tokens.find(
      (x) =>
        x.type === "TemplateHead" &&
        x.value.includes("const __sharedModuleFn =")
    );
    const wbTokenTail = tokens.find(
      (x) =>
        x.type === "TemplateTail" &&
        x.value.includes("__workerFn(__sharedModuleFn());")
    );
    if (wbTokenTail === undefined || wbTokenHead === undefined)
      throw new Error("Failed to find valid worker builder.");
    wbTokenHead.value =
      `function loadDesModderWorker(){${workerAppend}\n}` + wbTokenHead.value;
    wbTokenTail.value += `\nloadDesModderWorker();`;
  } else if (workerCodeTokens.length === 1) {
    // pre-esbuild
    const wcToken = workerCodeTokens[0];
    const newWorker = applyReplacements(
      enabledReplacements.filter((r) => r.workerOnly),
      // JSON.parse doesn't work because this is a single-quoted string.
      // js-tokens tokenized this as a string anyway, so it should be
      // safely eval'able to a string.
      // eslint-disable-next-line no-eval
      (0, eval)(wcToken.value) as string
    );
    wcToken.value = JSON.stringify(
      // Place at the beginning of the code for the source mapping to line up
      // Call at the end of the code to run after modules defined
      `function loadDesModderWorker(){${workerAppend}\n}` +
        newWorker +
        "\nloadDesModderWorker();"
    );
  } else {
    throw new Error("More than one worker code found");
  }
  return tokens.map((x) => x.value).join("");
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
