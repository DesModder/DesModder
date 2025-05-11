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
  // The import ends up being resolved to the absolute path `p`.
  const p = resolve(filename, source);
  if (!p) {
    // Probable something in the node_modules.
    return false;
  }
  // In the package `packageIn`, we're importing from the package `packageImported`.
  const packageIn = packageFilename(filename);
  const packageImported = packageFilename(p);
  // Importing within a package is always okay for this rule.
  if (packageIn === packageImported) return false;
  // For a diferent package, check its exports list.
  const exports = packageExports(packageImported);
  return !exports.has(p);
}

/**
 * Resolve an `import xxx from "source"` in the file `filename`
 * Return undefined if the resolution is probably in node_modules.
 */
function resolve(filename: string, source: string): string | undefined {
  if (source.startsWith(".")) {
    return path.resolve(path.dirname(filename), source);
  } else if (source.startsWith("#")) {
    const [hashRef, ...parts] = source.split(path.sep);
    const packageName = packageFilename(filename);
    const imports = packageImports(packageName);
    const packageDir = path.dirname(packageName);
    if (imports[hashRef]) {
      const value = imports[hashRef];
      if (!value.startsWith(".")) {
        // "#moo": "moo"
        return undefined;
      }
      return path.resolve(packageDir, imports[hashRef]);
    } else if (imports[hashRef + "/*"]) {
      const value = imports[hashRef + "/*"];
      if (!value.endsWith("/*")) {
        throw new Error(
          `Value for key '${hashRef + "/*"}' in 'imports' of ${packageName} missing trailing '/*'`
        );
      }
      return path.resolve(
        packageDir,
        value.slice(0, -"/*".length),
        parts.join(path.sep)
      );
    } else {
      throw new Error(
        `Missing 'imports' key for '${hashRef}' in ${packageName}`
      );
    }
  } else {
    return undefined;
  }
}

const packageImportsCache = new Map<string, Record<string, string>>();
function packageImports(packageFilename: string): Record<string, string> {
  if (packageImportsCache.has(packageFilename)) {
    return packageImportsCache.get(packageFilename)!;
  }
  const contents = fs.readFileSync(packageFilename, { encoding: "utf-8" });
  const json = JSON.parse(contents);
  return json.imports ?? {};
}

const packageExportsCache = new Map<string, Set<string>>();
function packageExports(packageFilename: string): Set<string> {
  if (packageExportsCache.has(packageFilename)) {
    return packageExportsCache.get(packageFilename)!;
  }
  const contents = fs.readFileSync(packageFilename, { encoding: "utf-8" });
  const json = JSON.parse(contents);
  const exports = new Set<string>();
  const packageDir = path.dirname(packageFilename);
  for (const exportRelPath of Object.keys(json.exports ?? {})) {
    exports.add(path.resolve(packageDir, exportRelPath));
  }
  packageExportsCache.set(packageFilename, exports);
  return exports;
}

const packageFilenameCache = new Map<string, string>();
function packageFilename(file: string): string {
  if (packageFilenameCache.has(file)) {
    return packageFilenameCache.get(file)!;
  }
  let dir = isDirectory(file) ? file : path.dirname(file);
  const dirs = [file, dir];
  while (dir.length > 1) {
    if (packageFilenameCache.has(dir)) {
      return packageFilenameCache.get(dir)!;
    }
    const maybePackage = path.join(dir, "package.json");
    if (fs.existsSync(maybePackage)) {
      for (const d of dirs) {
        packageFilenameCache.set(d, maybePackage);
      }
      return maybePackage;
    }
    dir = path.dirname(dir);
    dirs.push(dir);
  }
  throw new Error(`Failed to find package above '${file}'.`);
}

function isDirectory(file: string) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
