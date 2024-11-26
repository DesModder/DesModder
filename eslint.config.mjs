import rulesDirPlugin from "eslint-plugin-rulesdir";
import love from "eslint-config-love";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";

rulesDirPlugin.RULES_DIR = "scripts/eslint-rules";

export default tseslint.config(
  {
    ignores: [
      "coverage",
      "node_modules",
      "dist",
      "dist-ts",
      "hooks",
      "LICENSE*",
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
    },
  },
  {
    plugins: {
      rulesdir: rulesDirPlugin,
    },
    rules: {
      "rulesdir/no-format-in-ts": "error",
      "rulesdir/no-expect-promise": "error",
      "rulesdir/no-reach-past-exports": "error",
      "rulesdir/no-external-imports": "error",
      "rulesdir/no-timeouts-in-intellisense": "error",
    },
  }
);
