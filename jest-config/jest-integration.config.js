// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./jest-base.config");
/** @type any */
module.exports = {
  ...config,
  testPathIgnorePatterns: config.testPathIgnorePatterns.concat("\\.unit\\."),
  testEnvironment: "./src/tests/puppeteer-environment.js",
  globalSetup: "./src/tests/setup.js",
  globalTeardown: "./src/tests/teardown.js",
};
