import { esbuildPluginLezer } from "./loaders/esbuild-plugin-lezer.mjs";
import { esbuildPluginReplacements } from "./loaders/esbuild-plugin-replacements.mjs";
import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { lessLoader } from "esbuild-plugin-less";

const browser = "chrome";

build({
  entryPoints: [
    "src/background.ts",
    "src/script.ts",
    "src/preload/content.ts",
    "src/preload/script.ts",
    "src/worker/append.ts",
  ],
  bundle: true,
  outdir: "dist",
  plugins: [
    lessLoader(),
    esbuildPluginLezer(),
    esbuildPluginReplacements(),
    // The copy plugin *should* support array or glob "from", but I encountered
    //    error: Cannot read properties of undefined (reading 'slice')
    //    at setup (node_modules/esbuild-plugin-copy/dist/index.mjs:69:23)
    copy({
      resolveFrom: "cwd",
      assets: {
        from: [`./public/${browser}/*`],
        to: "dist",
      },
    }),
    copy({
      resolveFrom: "cwd",
      assets: {
        from: [`./public/common/*`],
        to: "dist",
      },
    }),
  ],
  define: {
    BROWSER: JSON.stringify(browser),
  },
  loader: {
    ".ts": "ts",
    ".ftl": "text",
    ".woff": "dataurl",
  },
});
