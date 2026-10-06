// Bundles the mock-up's TypeScript, with the plugin's real shared modules,
// into one self-contained page: docs/mockups/vector-3d-arrows.html.
//
//   node docs/mockups/vector-3d-arrows/build.mjs
//
// A single file because that is what gets published as an artifact, where
// nothing but the page itself can be loaded.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(here, "main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
  logLevel: "warning",
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const template = readFileSync(join(here, "template.html"), "utf8");
const page = template.replace("/*BUNDLE*/", () => script);
const out = join(here, "..", "vector-3d-arrows.html");
writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
