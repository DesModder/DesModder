import { esbuildPluginLezer } from "./esbuild-plugin-lezer.mjs";
import { lessLoader } from "esbuild-plugin-less";
import { loadFile } from "./utils.mjs";
import esbuild from "esbuild";
import { promises as fs } from "fs";
import path from "path";

const outdir = "dist";

const opts = {
  entryPoints: ["index.ts"],
  sourcemap: false,
  bundle: true,
  outdir,
  plugins: [lessLoader(), esbuildPluginLezer()],
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
// All dependencies are bundled in currently.
delete pkg.devDependencies;
delete pkg.dependencies;
Object.assign(pkg, {
  browser: "index.js",
  module: "index.js",
  type: "module",
  exports: { ".": "./index.js" },
});

await fs.writeFile(
  path.join(outdir, "package.json"),
  JSON.stringify(pkg, null, 2)
);

await fs.cp("./README.md", "./dist/README.md");
await fs.cp("./LICENSE", "./dist/LICENSE");
