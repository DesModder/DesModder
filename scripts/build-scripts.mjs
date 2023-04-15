import esbuild from "esbuild";

const opts = {
  entryPoints: ["scripts/audit-langs.ts"],
  bundle: true,
  outdir: "dist",
  platform: "node",
  loader: {
    ".ftl": "text",
  },
};

esbuild.build(opts);
