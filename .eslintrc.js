// eslint-disable-next-line @typescript-eslint/no-var-requires
const rulesDirPlugin = require("eslint-plugin-rulesdir");
rulesDirPlugin.RULES_DIR = "scripts/eslint-rules";

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  plugins: ["rulesdir"],
  extends: ["standard-with-typescript", "prettier"],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig-eslint.json",
  },
  ignorePatterns: [
    "coverage",
    "node_modules",
    "dist",
    "dist-ts",
    "hooks",
    "LICENSE",
    // Opt-out instead of opt-in to avoid forgetting to include some js file.
    "*.md",
    "*.json",
    "*.replacements",
    "*.grammar",
    "*.woff",
    "*.css",
    "*.less",
    "*.sh",
    "*.png",
    "*.ftl",
    "*.html",
    "*.woff",
    "*.svg",
    ".eslintrc.js",
  ],
  parser: "@typescript-eslint/parser",
  rules: {
    "rulesdir/no-format-in-ts": "error",
    "rulesdir/no-expect-promise": "error",
    "rulesdir/no-reach-past-exports": "error",
    "rulesdir/no-external-imports": "error",
    "rulesdir/no-timeouts-in-intellisense": "error",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/no-confusing-void-expression": [
      "error",
      {
        ignoreArrowShorthand: true,
      },
    ],
    "@typescript-eslint/consistent-type-imports": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-console": "error",
  },
};
