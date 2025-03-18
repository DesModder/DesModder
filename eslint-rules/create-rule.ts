import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/DesModder/DesModder/blob/main/eslint-rules/rules/${name}.ts`
);
