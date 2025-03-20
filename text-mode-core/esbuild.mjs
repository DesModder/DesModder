/* eslint-disable @desmodder/eslint-rules/no-external-imports */

/* eslint-disable @desmodder/eslint-rules/no-reach-past-exports */
import { loadFile } from "../loaders/utils.mjs";
import esbuild from "esbuild";
import { promises as fs } from "fs";
import path from "path";

const outdir = "dist";

const opts = {
  entryPoints: ["index.ts"],
  sourcemap: false,
  bundle: true,
  outdir,
  plugins: [],
  define: {
    window: "globalThis",
  },
  format: "esm",
  loader: { ".ts": "ts" },
  logLevel: "info",
};

// clean dist folder
try {
  await fs.rm(outdir, { recursive: true });
} catch (e) {
  // permit no dist folder to begin with
  if (e?.code !== "ENOENT") throw e;
}

await esbuild.build(opts);

const pkg = JSON.parse(await loadFile("./package.json"));
delete pkg.exports;
delete pkg.imports;
delete pkg.scripts;
Object.assign(pkg, {
  browser: "index.js",
  module: "index.js",
  types: "index.d.ts",
  type: "module",
  exports: { ".": "./index.js" },
});

await fs.writeFile(
  path.join(outdir, "package.json"),
  JSON.stringify(pkg, null, 2)
);

await fs.cp("./README.md", "./dist/README.md");
await fs.cp("./LICENSE", "./dist/LICENSE");
