import { loadFile } from "./utils.mjs";
import { buildParserFile } from "@lezer/generator";

export const esbuildPluginLezer = () => ({
  name: "lezer",
  setup(build) {
    build.onLoad({ filter: /\.grammar(\?terms)?$/ }, async (args) => {
      const grammar = await loadFile(args.path);

      const built = buildParserFile(grammar, {
        exportName: "__parser",
      });
      return {
        contents: built.parser + "\nexport default __parser\n" + built.terms,
      };
    });
  },
});

export default esbuildPluginLezer;
