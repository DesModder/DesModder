/**
 * What a rewrite did, in words, so a panel can say so.
 *
 * Shared by `condense` and `expand` because they are two directions of the same
 * conversation with the reader: a form that appears without explanation is one
 * the reader has to reverse-engineer, and that is worse for the expanded form
 * than for the factored one — `x²+3x+2` looks nothing like `(x+1)(x+2)` and
 * nothing about it says which one you started from.
 */
import type { Node } from "./tree";

export interface SimplificationNote {
  text: string;
  /**
   * The identity used, where the note is about one. Fixed text, so it can be
   * written here.
   */
  latex: string;
  /**
   * The factor that was pulled out, for a note about one.
   *
   * A tree rather than LaTeX, because emitting LaTeX needs a parser `Config`
   * and this module has no business holding one. The caller has it. The first
   * version guessed at a short label instead and printed `sin` for a factor of
   * `sin(3x)^{eˣ}` — a note naming something that is not a factor of anything.
   */
  factor?: Node;
}

/** The same note twice says nothing the first one did not. */
export function dedupe(
  notes: readonly SimplificationNote[]
): readonly SimplificationNote[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.text}|${note.latex}|${JSON.stringify(note.factor)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
