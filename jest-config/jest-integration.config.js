// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./jest-base.config");
/** @type any */
module.exports = {
  ...config,
  testPathIgnorePatterns: config.testPathIgnorePatterns.concat([
    "\\.unit\\.",
    "intellisense",
  ]),
  testEnvironment: "./src/tests/puppeteer-environment.js",
  globalSetup: "./src/tests/setup-integration.js",
  globalTeardown: "./src/tests/teardown.js",
  setupFilesAfterEnv: ["jest-expect-message"],
};
