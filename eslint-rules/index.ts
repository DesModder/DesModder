import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import rules from "./rules";

const PLUGIN_NAME = "@desmodder/eslint-rules";

const plugin = {
  meta: {
    name: PLUGIN_NAME,
  },
  rules,
} satisfies FlatConfig.Plugin;

const allRules = {
  "@desmodder/eslint-rules/no-expect-promise": "error",
  "@desmodder/eslint-rules/no-external-imports": "error",
  "@desmodder/eslint-rules/no-format-in-ts": "error",
  "@desmodder/eslint-rules/no-reach-past-exports": "error",
  "@desmodder/eslint-rules/no-timeouts-in-intellisense": "error",
} satisfies Record<
  `${typeof PLUGIN_NAME}/${keyof typeof rules}`,
  FlatConfig.RuleEntry
>;

const config = {
  plugins: { [PLUGIN_NAME]: plugin },
  rules: allRules,
} satisfies FlatConfig.Config;

export default { plugin, config };
