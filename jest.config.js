/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  preset: "ts-jest",
  coverageReporters: ["html", "lcov", "text"],
  coverageDirectory: "<rootDir>/coverage",
  transform: {
    "^.+\\.ts": "ts-jest",
    "\\.grammar": "<rootDir>/jest-config/lezer-transformer.js",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  moduleDirectories: ["node_modules", "src"],
  testEnvironment: "jsdom",
};
