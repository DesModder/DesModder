const buildLezer = require("lezer-loader").default;
const tsJest = require("ts-jest");
const tsJestTransformer = new tsJest.TsJestTransformer();
const fs = require("fs");

module.exports = {
  process(sourceText, sourcePath, config) {
    const newPath = sourcePath.replace(".grammar", ".ts");
    const ts = buildLezer(sourceText).replace(
      "LRParser.",
      "(LRParser as any)."
    );
    // tsJestTranformer needs the path of the file, and it needs to be valid
    // even though tsJestTranformer takes in the string contents of the file
    fs.writeFileSync(newPath, ts);
    try {
      return tsJestTransformer.process(ts, newPath, config);
    } finally {
      fs.unlinkSync(newPath);
    }
  },
};
