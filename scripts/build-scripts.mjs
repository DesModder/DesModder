import esbuild from "esbuild";

const opts = {
  entryPoints: ["scripts/audit-langs.ts"],
  bundle: true,
  sourcemap: "linked",
  outdir: "dist",
  platform: "node",
  loader: {
    ".ftl": "text",
  },
};

void esbuild.build(opts);
