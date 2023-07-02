/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./jest-base.config");
module.exports = {
  ...config,
  testPathIgnorePatterns: config.testPathIgnorePatterns.concat("\\.unit\\."),
  testEnvironment: "node",
};
