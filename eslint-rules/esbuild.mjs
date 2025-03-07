import esbuild from "esbuild";

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ["./index.ts"],
  bundle: true,
  sourcemap: "linked",
  outdir: "./dist",
  platform: "node",
  format: "esm",
  packages: "external",
};

void esbuild.build(opts);
