import type { Linter } from "@typescript-eslint/utils/ts-eslint";
import noExpectPromise from "./no-expect-promise";
import noExternalImports from "./no-external-imports";
import noFormatInTs from "./no-format-in-ts";
import noReachPastExports from "./no-reach-past-exports";
import noTimeoutsInIntellisense from "./no-timeouts-in-intellisense";

const rules = {
  "no-expect-promise": noExpectPromise,
  "no-external-imports": noExternalImports,
  "no-format-in-ts": noFormatInTs,
  "no-reach-past-exports": noReachPastExports,
  "no-timeouts-in-intellisense": noTimeoutsInIntellisense,
} satisfies Linter.PluginRules;

export default rules;
