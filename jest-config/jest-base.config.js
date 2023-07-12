/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  preset: "ts-jest",
  rootDir: "../",
  coverageReporters: ["html", "lcov", "text"],
  coverageDirectory: "<rootDir>/coverage",
  transform: {
    "^.+\\.ts": [
      "ts-jest",
      {
        tsconfig: {
          moduleResolution: "node",
          module: "es6",
        },
        isolatedModules: true,
      },
    ],
    "\\.grammar": "<rootDir>/jest-config/lezer-transformer.mjs",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/"],
  moduleDirectories: ["node_modules", "src"],
};
