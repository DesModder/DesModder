/**
 * The panel and the runtime agree about what is in the panel.
 *
 * `AudioLabRuntime.find` throws when an element is missing, and it is called
 * from the constructor, so one renamed `data-audio-lab` attribute does not
 * degrade the panel — it stops the panel from opening at all. That failure is
 * invisible to every other test here, because they all exercise the engine, the
 * adapter, and the renderer directly and never build the DOM.
 *
 * Reading the two files is a blunt way to check it, and it is the check that
 * matches the failure: the coupling really is a pair of string literals in two
 * files, and nothing else in the type system is watching them.
 */
import { readFileSync } from "fs";
import { join } from "path";

const directory = join("src", "plugins", "audio-lab");
const runtime = readFileSync(join(directory, "AudioLabRuntime.ts"), "utf8");
const panel = readFileSync(join(directory, "AudioLabPanel.tsx"), "utf8");

// Both ways the view reaches an element: `find` for a plain lookup, and the
// `on` helper, which does a `find` and then attaches a listener.
const lookedUp = new Set([
  ...[...runtime.matchAll(/find<[^>]*>\(\s*"([^"]+)"/g)].map(
    ([, name]) => name
  ),
  ...[...runtime.matchAll(/\bon(?:<[^>]*>)?\(\s*"([^"]+)"/g)].map(
    ([, name]) => name
  ),
]);
const declared = new Set([
  ...[...panel.matchAll(/data-audio-lab="([^"]+)"/g)].map(([, name]) => name),
  // The canvases are placeholders in the markup and are swapped for real
  // elements at mount, but they answer to the same lookup.
  ...[...panel.matchAll(/data-audio-lab-placeholder="([^"]+)"/g)].map(
    ([, name]) => name
  ),
]);

describe("the panel and the runtime", () => {
  test("the runtime looks up a useful number of elements", () => {
    // A guard on the regexes themselves: if either stops matching, the two
    // comparisons below would pass by both being empty.
    expect(lookedUp.size).toBeGreaterThan(20);
    expect(declared.size).toBeGreaterThan(20);
  });

  test("every element the runtime looks up is in the panel", () => {
    expect([...lookedUp].filter((name) => !declared.has(name))).toEqual([]);
  });

  test("every element in the panel is one the runtime uses", () => {
    // The other direction matters less, but a stale hook is a control that
    // looks live and does nothing when clicked.
    expect([...declared].filter((name) => !lookedUp.has(name))).toEqual([]);
  });
});
