import { loadFile } from "./utils.mjs";
import { buildParserFile } from "@lezer/generator";

export const esbuildPluginLezer = () => ({
  name: "lezer",
  setup(build) {
    build.onLoad({ filter: /\.grammar(\?terms)?$/ }, async (args) => {
      const grammar = await loadFile(args.path);

      return {
        contents: buildLezer(grammar),
      };
    });
  },
});

/**
 * Build lezer grammar to JavaScript
 *
 * @param {string} grammar contents of .grammar file
 * @returns {string} resulting JavaScript code
 */
export function buildLezer(grammar) {
  const built = buildParserFile(grammar, {
    exportName: "__parser",
  });
  return built.parser + "\nexport default __parser\n" + built.terms;
}

export default esbuildPluginLezer;
