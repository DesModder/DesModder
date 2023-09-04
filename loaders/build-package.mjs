import { esbuildPluginLezer } from "./esbuild-plugin-lezer.mjs";
import { lessLoader } from "esbuild-plugin-less";
import { loadFile } from "./utils.mjs";
import esbuild from "esbuild";
import { promises as fs } from "fs";
import path from "node:path";
import os from "node:os";
import parseArgs from "minimist-lite";

const argv = parseArgs(process.argv.slice(2));

const outdir = "dist";
const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "dsm-pkg-"));

const opts = {
  entryPoints: ["index.ts"],
  sourcemap: false,
  bundle: true,
  outdir: tmpdir,
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
await fs.mkdir(outdir, { recursive: true });

await esbuild.build(opts);

let js = await loadFile(path.join(tmpdir, "index.js"));
if (argv["inline-insert-css"]) {
  const css = await loadFile(path.join(tmpdir, "index.css"));

  js = `(function __dsm_insertCSS() {
    const style = document.createElement("style");
    style.innerHTML = ${JSON.stringify(css)};
    document.head.appendChild(style);
  })()
  ${js}`;
}
await fs.writeFile(path.join(outdir, "index.js"), js);

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
