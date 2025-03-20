import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";

export default createRule({
  name: "no-format-in-ts",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow using format() in TS files. ",
    },
    messages: {
      noFormatInTS:
        "Avoid using format() in TS files. " +
        "Use format() only where it will be updated by a view update.",
    },
    schema: [],
  },
  defaultOptions: [],
  create: function (context) {
    return {
      CallExpression: function (node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === "format"
        ) {
          const { filename } = context;
          if (!filename.endsWith(".jsx") && !filename.endsWith(".tsx")) {
            context.report({
              messageId: "noFormatInTS",
              node: node.callee,
              data: {},
            });
          }
        }
      },
    };
  },
});
