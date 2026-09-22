/**
 * Every equation this plugin ships is written the way Desmos writes one.
 *
 * These strings are not internal. They are put in front of people in an
 * editable box, copied out of it, and pasted into graphs — so a group spelled
 * with a bare parenthesis, or an exponent without its braces, is a small lie
 * about where the expression came from. The compiler accepts the shorter
 * spellings, which is exactly why this needs a test rather than a failure.
 *
 * Both lists are checked here because both end up in the same box: this
 * plugin's own presets and the shared gallery's.
 */
import { FIELD_GALLERY, configFromGalleryPreset } from "./gallery";
import { AUDIO_FIELD_PRESETS } from "./model";
import { compileAudioField } from "./compile";

const LEFT = String.raw`\left`;
const RIGHT = String.raw`\right`;

/** Parentheses Desmos would have written as `\left(` and `\right)`. */
function bareParens(latex: string) {
  const found: string[] = [];
  for (let i = 0; i < latex.length; i++) {
    const before = latex.slice(0, i);
    if (latex[i] === "(" && !before.endsWith(LEFT))
      found.push(`bare "(" at ${i}`);
    if (latex[i] === ")" && !before.endsWith(RIGHT))
      found.push(`bare ")" at ${i}`);
  }
  return found;
}

/** Exponents Desmos would have braced: `x^{2}`, never `x^2`. */
function unbracedExponents(latex: string) {
  return [...latex.matchAll(/\^(?!\{)/g)].map(
    (match) => `unbraced "^" at ${match.index}`
  );
}

/**
 * Spaces Desmos would not have written.
 *
 * A command is already terminated by the backslash that begins `\left`, so the
 * space between them carries nothing. It parses, and it is the giveaway that a
 * string was assembled rather than typed.
 */
function straySpaces(latex: string) {
  return [...latex.matchAll(/\\[a-zA-Z]+ +\\left/g)].map(
    (match) => `space before "\\left" at ${match.index}`
  );
}

function problems(latex: string) {
  return [
    ...bareParens(latex),
    ...unbracedExponents(latex),
    ...straySpaces(latex),
  ];
}

const everyEquation: ReadonlyArray<readonly [string, string]> = [
  ...AUDIO_FIELD_PRESETS.flatMap(
    (preset) =>
      [
        [`${preset.id} P`, preset.config.p],
        [`${preset.id} Q`, preset.config.q],
      ] as const
  ),
  ...FIELD_GALLERY.flatMap((preset) => {
    const config = configFromGalleryPreset(preset);
    return [
      [`gallery ${preset.id} P`, config.p],
      [`gallery ${preset.id} Q`, config.q],
    ] as const;
  }),
];

describe("the equations are in Desmos's own format", () => {
  test("there are equations to check", () => {
    // A guard on the list itself: the per-equation checks below would all pass
    // on an empty list.
    expect(everyEquation.length).toBe(
      (AUDIO_FIELD_PRESETS.length + FIELD_GALLERY.length) * 2
    );
  });

  test("the check would actually catch something", () => {
    // Without this, a checker that stopped working would let the whole suite
    // pass by finding nothing wrong with anything.
    expect(problems("2(x+1)")).not.toEqual([]);
    expect(problems("x^2")).not.toEqual([]);
    expect(problems(String.raw`\sin \left(t\right)`)).not.toEqual([]);
    expect(problems(String.raw`\left(x+1\right)^{2}`)).toEqual([]);
    expect(problems(String.raw`\frac{x}{\sqrt{y}}`)).toEqual([]);
    // A space that is not before a `\left` is how `\sin t` is written, and
    // that is Desmos's own spelling rather than an assembled one.
    expect(problems(String.raw`3\sin t`)).toEqual([]);
  });

  test.each(everyEquation)("%s", (name, latex) => {
    expect([name, problems(latex)]).toEqual([name, []]);
  });
});

describe("what the boxes hold still compiles", () => {
  test.each(everyEquation)("%s", (_name, latex) => {
    // The rules above are about how it is spelled. This is the other half: a
    // spelling the compiler cannot read is worse than an untidy one.
    const config = configFromGalleryPreset(FIELD_GALLERY[0]);
    config.p = latex;
    config.q = "0";
    const compiled = compileAudioField(config);
    expect(compiled.ok ? "" : compiled.error).toBe("");
  });
});
