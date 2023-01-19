import { buildLezer } from "../loaders/esbuild-plugin-lezer.mjs";
import { writeFileSync, unlinkSync } from "fs";
import { TsJestTransformer } from "ts-jest";

const tsJestTransformer = new TsJestTransformer();

export function process(sourceText, sourcePath, config) {
  const newPath = sourcePath.replace(".grammar", ".js");
  const ts = buildLezer(sourceText);
  // tsJestTranformer needs the path of the file, and it needs to be valid
  // even though tsJestTranformer takes in the string contents of the file
  writeFileSync(newPath, ts);
  try {
    return tsJestTransformer.process(ts, newPath, config);
  } finally {
    unlinkSync(newPath);
  }
}

export default { process };
