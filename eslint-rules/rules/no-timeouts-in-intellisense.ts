import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";

export default createRule({
  name: "no-timeouts-in-intellisense",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow using setTimeout() in intellisense TS files. ",
    },
    messages: {
      noTimeoutsInIntellisense:
        "Don't use setTimeout() in Intellisense. Use setIntellisenseTimeout()" +
        " instead so that timeouts can be tracked by automated testing.",
    },
    schema: [],
  },
  defaultOptions: [],
  create: function (context) {
    return {
      CallExpression: function (node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === "setTimeout"
        ) {
          const path = context.physicalFilename;
          if (path.includes("intellisense")) {
            context.report({
              messageId: "noTimeoutsInIntellisense",
              node: node.callee,
              data: {},
            });
          }
        }
      },
    };
  },
});
