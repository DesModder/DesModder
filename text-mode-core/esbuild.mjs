/* eslint-disable rulesdir/no-external-imports */

/* eslint-disable rulesdir/no-reach-past-exports */
import { loadFile } from "../loaders/utils.mjs";
import esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { promises as fs } from "fs";
import path from "path";

const outdir = "dist";

const opts = {
  entryPoints: ["index.ts"],
  sourcemap: false,
  bundle: true,
  outdir,
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./LICENSE", "./README.md"],
        to: outdir,
      },
    }),
  ],
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
