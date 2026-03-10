import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../create-rule";
import ts from "typescript";
import * as path from "node:path";

function getRealSymbol(checker: ts.TypeChecker, node: ts.Node) {
  let symbol = checker.getSymbolAtLocation(node);
  while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

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
        const program = context.sourceCode?.parserServices?.program;
        const checker = program?.getTypeChecker();
        if (!program || !checker) return;
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === "format"
        ) {
          const { filename } = context;
          const calleeTsNode =
            context.sourceCode.parserServices?.esTreeNodeToTSNodeMap?.get(
              node.callee
            );
          if (!calleeTsNode) return;
          const sourcePath = getRealSymbol(
            checker,
            calleeTsNode
          )?.valueDeclaration?.getSourceFile().fileName;
          if (!sourcePath) return;
          if (
            path.resolve(sourcePath) ===
              path.resolve(
                import.meta.dirname,
                "../../localization/i18n-core.ts"
              ) &&
            !filename.endsWith(".jsx") &&
            !filename.endsWith(".tsx")
          ) {
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
