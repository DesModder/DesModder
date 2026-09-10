/**
 * Every plugin a user can switch on has to appear in the settings menu.
 *
 * `categoryPlugins` in `Menu.tsx` is a hand-written list, and a plugin missing
 * from it is invisible: it never renders a row, so it can never be enabled, so
 * whatever entry point it adds on enable never appears either. The plugin is
 * registered, loaded, and completely unreachable.
 *
 * Nothing else catches this. The integration tests enable plugins through
 * `DSM.togglePluginsTo`, which bypasses the menu entirely, so they pass against
 * a plugin no user can reach. Physics Lab shipped in exactly that state and was
 * found by someone looking for its button rather than by the suite.
 *
 * Both sides are read out of the source rather than imported, because importing
 * the plugin registry pulls in DCGView, which needs a real page to exist. That
 * is blunt, and it is also the check that matches the failure: the coupling
 * really is one array of string literals against a set of class fields, and
 * nothing in the type system is watching the two agree.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const PLUGINS_DIR = join("src", "plugins");

const menuSource = readFileSync(
  join("src", "core-plugins", "pillbox-menus", "components", "Menu.tsx"),
  "utf8"
);

/** The ids listed inside the `categoryPlugins` object literal. */
const listed = new Set(
  [
    ...(
      /const categoryPlugins[\s\S]*?\n};/.exec(menuSource)?.[0] ?? ""
    ).matchAll(/"([a-zA-Z0-9-]+)"/g),
  ].map(([, id]) => id)
);

/**
 * Every id declared by a plugin under `src/plugins`. Everything there is
 * user-toggleable; the four that cannot be disabled live in `src/core-plugins`
 * and are deliberately absent from the menu.
 */
function declaredPluginIDs() {
  const ids: string[] = [];
  for (const entry of readdirSync(PLUGINS_DIR)) {
    const directory = join(PLUGINS_DIR, entry);
    if (!statSync(directory).isDirectory()) continue;
    for (const name of ["index.ts", "index.tsx"]) {
      let source: string;
      try {
        source = readFileSync(join(directory, name), "utf8");
      } catch {
        continue;
      }
      const found = /static id = "([a-zA-Z0-9-]+)" as const;/.exec(source);
      if (found) ids.push(found[1]);
    }
  }
  return ids;
}

describe("the settings menu and the plugins that exist", () => {
  const declared = declaredPluginIDs();

  test("the scan found the plugins, so an empty result cannot pass by accident", () => {
    expect(declared.length).toBeGreaterThan(20);
    expect(declared).toContain("vector-tools");
    expect(listed.size).toBeGreaterThan(20);
  });

  test("every plugin appears in a category, or nobody can enable it", () => {
    expect(declared.filter((id) => !listed.has(id))).toEqual([]);
  });

  test("every listed id belongs to a plugin that exists", () => {
    expect([...listed].filter((id) => !declared.includes(id))).toEqual([]);
  });
});
