import * as tsutils from "ts-api-utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { Node, TypeChecker } from "typescript";
import { createRule } from "../create-rule";

export default createRule({
  name: "no-expect-promise",
  meta: {
    type: "problem",
    docs: {
      // The type system does not enforce .resolves.
      description: "Disallow using expect() on a Promise.",
    },
    messages: {
      noExpectPromise:
        "Avoid using expect() on a Promise. Did you forget an `await`?",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const [argNode] = node.arguments;
        if (
          argNode &&
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === "expect"
        ) {
          const { parserServices } = context.sourceCode;
          const checker = parserServices?.program?.getTypeChecker();
          const originalArgNode =
            parserServices?.esTreeNodeToTSNodeMap?.get(argNode);
          if (!checker || !originalArgNode) return;
          if (isSometimesThenable(checker, originalArgNode))
            context.report({
              messageId: "noExpectPromise",
              node: argNode,
              data: {},
            });
        }
      },
    };
  },
});

// https://github.com/typescript-eslint/typescript-eslint/blob/4bf2d7360eaf74c9ef87b196ff4c459b8f50800b/packages/eslint-plugin/src/rules/no-misused-promises.ts#L416
function isSometimesThenable(checker: TypeChecker, node: Node) {
  const _type = checker.getTypeAtLocation(node);
  const type = checker.getApparentType(_type);

  return tsutils
    .unionTypeParts(type)
    .some((subType) => tsutils.isThenableType(checker, node, subType));
}
