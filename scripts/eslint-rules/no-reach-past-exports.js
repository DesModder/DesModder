/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");
const tmExports = require("../../text-mode-core/package.json");

module.exports = {
  name: "no-reach-past-exports",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing in violation of package.json 'exports'",
      category: "Best Practices",
    },
    messages: {
      noReachPastExports:
        "Avoid importing past the 'exports' boundary of a sub-project.",
    },
    schema: [],
  },
  create: function (context) {
    return {
      ImportDeclaration: function (node) {
        if (node.source.type === "Literal") {
          const source = node.source.value;
          const filename = context.getFilename();
          if (bad(filename, source)) {
            context.report({
              messageId: "noReachPastExports",
              node: node.source,
              data: {},
            });
          }
        }
      },
    };
  },
};

// Kinda like @nx/enforce-module-boundaries but way simpler
// Janky, good temporary though.
function bad(filename, source) {
  // TODO: handle absolutes.
  if (source[0] !== ".") return false;
  const p = path.resolve(path.dirname(filename), source);
  if (allowed.some((a) => p.endsWith(a))) return false;
  return packageDir(filename) !== packageDir(p);
}

const allowed = Object.keys(tmExports.exports).map((a) =>
  path.resolve("text-mode-core", a)
);

function packageDir(file) {
  let dir = isDirectory(file) ? file : path.dirname(file);
  while (dir.length > 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return dir;
}

function isDirectory(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
