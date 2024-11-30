/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require("./jest-base.config");
/** @type any */
module.exports = {
  ...config,
  testPathIgnorePatterns: config.testPathIgnorePatterns.concat("\\.int\\."),
  testEnvironment: "jsdom",
  globalSetup: "./src/tests/setup-unit.js",
};
