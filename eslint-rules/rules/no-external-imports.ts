import { createRule } from "../create-rule";

export default createRule({
  name: "no-external-imports",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing in violation of package.json 'imports'",
    },
    messages: {
      noExternalImports:
        "Avoid importing from sub-projects other than specified in 'imports'. " +
        "If you're just using types, write 'import type ...'",
    },
    schema: [],
  },
  defaultOptions: [],
  create: function (context) {
    if (!context.filename.includes("text-mode-core")) return {};
    return {
      ImportDeclaration: function (node) {
        if (node.importKind !== "type") {
          const source = node.source.value;
          if (!source.startsWith(".") && !source.startsWith("#")) {
            context.report({
              messageId: "noExternalImports",
              node: node.source,
              data: {},
            });
          }
        }
      },
    };
  },
});
