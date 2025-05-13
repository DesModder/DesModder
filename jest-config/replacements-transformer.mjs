import { writeFileSync, unlinkSync } from "fs";
import path from "path";

export function process(sourceText, sourcePath, config) {
  return {
    code:
      "module.exports = " +
      // Assumes esModuleInterop=true. Otherwise you'll need to wrap in `{default: {...}}
      // We set esModuleInterop=true to get jsTokens to load right in jest.
      JSON.stringify({
        file: sourceText,
        filename: path.basename(sourcePath),
      }),
  };
}

export default { process };
