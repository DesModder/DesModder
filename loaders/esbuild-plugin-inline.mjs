import esbuild from "esbuild";
import path from "path";

export const esbuildPluginInline = () => ({
  name: "inline",
  setup(build) {
    build.onLoad({ filter: /\.inline\.[jt]sx?$/ }, async (args) => {
      const workerPath = args.path;
      const outfile = path.basename(workerPath) + ".inline";
      const built = await esbuild.build({
        entryPoints: [workerPath],
        bundle: true,
        outfile,
        write: false,
      });

      const out = built.outputFiles.find((x) => x.path.endsWith(outfile));

      if (out === undefined) {
        return {
          errors: [
            {
              detail: `[esbuild-plugin-inline] No output from build of '${workerPath}'.`,
            },
          ],
        };
      }

      return {
        contents: `export default ${JSON.stringify(
          Buffer.from(out.contents).toString("utf-8")
        )};`,
        loader: "js",
      };
    });
  },
});

export default esbuildPluginInline;
