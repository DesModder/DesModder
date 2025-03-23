/* eslint-disable @desmodder/eslint-rules/no-reach-past-exports */
import path from "path";
import fs from "fs";
import { createRule } from "../create-rule";
import tmExports from "../../text-mode-core/package.json" with { type: "json" };
import gsExports from "../../graph-state/package.json" with { type: "json" };

export default createRule({
  name: "no-reach-past-exports",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing in violation of package.json 'exports'",
    },
    messages: {
      noReachPastExports:
        "Avoid importing past the 'exports' boundary of a sub-project.",
    },
    schema: [],
  },
  defaultOptions: [],
  create: function (context) {
    return {
      ImportDeclaration: function (node) {
        const source = node.source.value;
        const { filename } = context;
        if (bad(filename, source)) {
          context.report({
            messageId: "noReachPastExports",
            node: node.source,
            data: {},
          });
        }
      },
    };
  },
});

// Kinda like @nx/enforce-module-boundaries but way simpler
// Janky, good temporary though.
function bad(filename: string, source: string) {
  // TODO: handle absolutes.
  if (!source.startsWith(".")) return false;
  const p = path.resolve(path.dirname(filename), source);
  if (allowed.some((a) => p.endsWith(a))) return false;
  return packageDir(filename) !== packageDir(p);
}

const allowed = [
  ...Object.keys(tmExports.exports).map((a) =>
    path.resolve("text-mode-core", a)
  ),
  ...Object.keys(gsExports.exports).map((a) => path.resolve("graph-state", a)),
];

function packageDir(file: string) {
  let dir = isDirectory(file) ? file : path.dirname(file);
  while (dir.length > 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return dir;
}

function isDirectory(file: string) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
