const path = require("path");
const buildLezer = require("lezer-loader").default;
const tsJest = require("ts-jest");
const tsJestTransformer = new tsJest.TsJestTransformer();

module.exports = {
  process(src, filename, config, options) {
    const ts = buildLezer(src).replace("LRParser.", "(LRParser as any).");
    return tsJestTransformer.process(
      ts,
      filename.replace(".grammar", ".ts"),
      config
    );
  },
};
