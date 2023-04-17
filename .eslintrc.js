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
    project: "tsconfig.json",
  },
  ignorePatterns: ["src/frontend/grammar*"],
  parser: "@typescript-eslint/parser",
  rules: {
    "rulesdir/no-format-in-ts": "error",
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
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "no-type-imports" },
    ],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
  },
};
