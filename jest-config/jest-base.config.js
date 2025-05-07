/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  preset: "ts-jest",
  rootDir: "../",
  coverageReporters: ["html", "lcov", "text"],
  coverageDirectory: "<rootDir>/coverage",
  transform: {
    "^.+\\.[tj]s": [
      "ts-jest",
      {
        tsconfig: {
          moduleResolution: "node",
          module: "es6",
          allowJs: true,
        },
        isolatedModules: true,
      },
    ],
    "\\.grammar": "<rootDir>/jest-config/lezer-transformer.mjs",
    "\\.replacements": "<rootDir>/jest-config/replacements-transformer.mjs",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "dist", "dist-ts"],
  moduleDirectories: ["node_modules", "src"],
  transformIgnorePatterns: [
    "setup-unit",
    // The following packages are ESM, and unit tests need them to be transformed.
    "node_modules/(?!ansi-regex|string-length|strip-ansi|get-east-asian-width|emoji-regex|string-width)",
  ],
  moduleNameMapper: {
    "^#metadata/(.*)$": "<rootDir>/metadata/$1",
  },
};
