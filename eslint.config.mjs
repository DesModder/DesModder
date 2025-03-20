import love from "eslint-config-love";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import dsmeslint from "@desmodder/eslint-rules";

export default tseslint.config(
  {
    ignores: [
      "coverage",
      "node_modules",
      "dist",
      "dist-ts",
      "hooks",
      "LICENSE*",
      "**/dist",
      "**/dist-ts",
      // Opt-out instead of opt-in to avoid forgetting to include some js file.
      "**/*.md",
      "**/*.json",
      "**/*.replacements",
      "**/*.grammar",
      "**/*.woff",
      "**/*.css",
      "**/*.less",
      "**/*.sh",
      "**/*.png",
      "**/*.ftl",
      "**/*.html",
      "**/*.svg",
      "**/*.zip",
      "eslint.config.mjs",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,cjs,mjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // "love" is a new name for "standard-with-typescript"
  love,
  eslintConfigPrettier,
  {
    rules: {
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
      "@typescript-eslint/no-unsafe-argument": "off",

      "@typescript-eslint/prefer-destructuring": [
        "error",
        { array: true, object: true },
        {
          enforceForRenamedProperties: false,
          enforceForDeclarationWithTypeAnnotation: false,
        },
      ],

      // Workarounds to avoid errors in existing code
      "@typescript-eslint/only-throw-error": [
        "error",
        { allowThrowingAny: false, allowThrowingUnknown: true },
      ],
      "@typescript-eslint/class-methods-use-this": "off",
      "@typescript-eslint/max-params": "off",
      "@typescript-eslint/init-declarations": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-loop-func": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-arguments": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-unary-minus": "off",
      "eslint-comments/require-description": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      "@typescript-eslint/no-unsafe-type-assertion": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  dsmeslint.config
);
