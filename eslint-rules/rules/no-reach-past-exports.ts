import path from "path";
import fs from "fs";
import { createRule } from "../create-rule";

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
  // In the file `filename`, import `source`.
  // TODO: handle absolutes.
  if (!source.startsWith(".")) return false;
  // The import ends up being resolved to the absolute path `p`.
  const p = path.resolve(path.dirname(filename), source);
  // In the package `packageIn`, we're importing from the package `packageImported`.
  const packageIn = packageFilename(filename);
  const packageImported = packageFilename(p);
  // Importing within a package is always okay for this rule.
  if (packageIn === packageImported) return false;
  // For a diferent package, check its exports list.
  const exports = packageExports(packageImported);
  return !exports.has(p);
}

function packageExports(packageFilename: string) {
  const contents = fs.readFileSync(packageFilename, { encoding: "utf-8" });
  const json = JSON.parse(contents);
  if (!json.exports) {
    return new Set();
  }
  const exports = new Set();
  const packageDir = path.dirname(packageFilename);
  for (const exportRelPath of Object.keys(json.exports ?? {})) {
    exports.add(path.resolve(packageDir, exportRelPath));
  }
  return exports;
}

function packageFilename(file: string) {
  let dir = isDirectory(file) ? file : path.dirname(file);
  while (dir.length > 1) {
    const maybePackage = path.join(dir, "package.json");
    if (fs.existsSync(maybePackage)) return maybePackage;
    dir = path.dirname(dir);
  }
  throw new Error("Failed to find.");
}

function isDirectory(file: string) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
