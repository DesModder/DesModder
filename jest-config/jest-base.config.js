/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  preset: "ts-jest",
  rootDir: "../",
  coverageReporters: ["html", "lcov", "text"],
  coverageDirectory: "<rootDir>/coverage",
  transform: {
    "^.+\\.ts|^.*string-width/index.js": [
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
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "dist", "dist-ts"],
  moduleDirectories: ["node_modules", "src"],
  transformIgnorePatterns: ["node_modules/(?!string-width/.*)"],
};
