// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("./jest-base.config");
/** @type any */
module.exports = {
  ...config,
  testPathIgnorePatterns: config.testPathIgnorePatterns.concat([
    "\\.unit\\.",
    "intellisense",
  ]),
  testEnvironment: "./tests/puppeteer-environment.js",
  globalSetup: "./tests/setup-integration.js",
  globalTeardown: "./tests/teardown.js",
  setupFilesAfterEnv: ["jest-expect-message"],
};
