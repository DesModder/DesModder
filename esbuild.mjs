import { esbuildPluginInline } from "./loaders/esbuild-plugin-inline.mjs";
import { esbuildPluginLezer } from "./loaders/esbuild-plugin-lezer.mjs";
import { esbuildPluginReplacements } from "./loaders/esbuild-plugin-replacements.mjs";
import { loadFile } from "./loaders/utils.mjs";
import esbuild from "esbuild";
import { copy } from "esbuild-plugin-copy";
import { lessLoader } from "esbuild-plugin-less";
import { promises as fs } from "fs";
import parseArgs from "minimist-lite";

const argv = parseArgs(process.argv.slice(2));

const unindent2spaces = (s) => s.toString().replaceAll(/\n {2}|\n\s*$/g, "\n");

if (argv.help) {
  console.log(
    unindent2spaces`Usage:
    node esbuild.mjs [options]
  
  Options:
    --help         Show help
    --browser=...  Browser target: "firefox", or "chrome"  [default: "chrome"]
    --watch        Watch mode: rebuild on file system changes [default: false]
    
  Examples:
    # Dev server for Chrome
    node esbuild.mjs --watch --browser=chrome
    
    # Final build for Firefox
    node esbuild.mjs --browser=firefox`
  );
  process.exit(0);
}

if (
  argv.browser !== undefined &&
  !["firefox", "chrome"].includes(argv.browser)
) {
  console.error(`Invalid browser name: ${argv.browser}`);
  process.exit(1);
}
const { version } = JSON.parse(await loadFile("./package.json"));
const browser = argv.browser ?? "chrome";
const watch = !!argv.watch;

const opts = {
  entryPoints: [
    "src/background.ts",
    "src/script.ts",
    "src/preload/content.ts",
    "src/preload/script.ts",
  ],
  // don't include source map on release builds
  sourcemap: watch ? "inline" : false,
  bundle: true,
  outdir: "dist",
  plugins: [
    lessLoader(),
    esbuildPluginInline(),
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
    VERSION: JSON.stringify(version),
  },
  loader: {
    ".ts": "ts",
    ".ftl": "text",
    ".woff": "dataurl",
    ".html": "text",
  },
  logLevel: "info",
};

// clean dist folder
try {
  await fs.rm("dist", { recursive: true });
} catch (e) {
  // permit no dist folder to begin with
  if (e?.code !== "ENOENT") throw e;
}

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.rebuild();
  await ctx.watch();
} else {
  esbuild.build(opts);
}
