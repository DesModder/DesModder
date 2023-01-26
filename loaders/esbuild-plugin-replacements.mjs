import { loadFile } from "./utils.mjs";
import path from "path";

export const esbuildPluginReplacements = () => ({
  name: "replacements",
  setup(build) {
    build.onLoad({ filter: /\.replacements$/ }, async (args) => {
      const content = await loadFile(args.path);

      return {
        contents:
          "export default " +
          JSON.stringify({
            file: content,
            filename: path.basename(args.path),
          }),
      };
    });
  },
});

export default esbuildPluginReplacements;
