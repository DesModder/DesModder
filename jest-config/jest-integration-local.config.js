// eslint-disable-next-line @typescript-eslint/no-require-imports
const configIntegration = require("./jest-integration.config");
/** @type any */
module.exports = {
  ...configIntegration,
  testPathIgnorePatterns: configIntegration.testPathIgnorePatterns.filter(
    (e) => e !== "intellisense"
  ),
};
