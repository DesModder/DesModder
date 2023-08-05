module.exports = {
  name: "no-timeouts-in-intellisense",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow using setTimeout() in intellisense TS files. ",
      category: "Best Practices",
    },
    messages: {
      noTimeoutsInIntellisense:
        "Don't use setTimeout() in Intellisense. Use setIntellisenseTimeout()" +
        " instead so that timeouts can be tracked by automated testing.",
    },
    schema: [],
  },
  create: function (context) {
    return {
      CallExpression: function (node) {
        if (
          node.callee.type === "Identifier" &&
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
};
