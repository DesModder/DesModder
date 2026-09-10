/**
 * Reading and rewriting the names in a piece of Desmos LaTeX.
 *
 * Three places need to agree on what counts as one identifier: the environment
 * scan, the GLSL compiler, and the generator, which has to rename a variable on
 * its way into the expression list. They agree by all coming here.
 *
 * A name cannot be found by searching for the letter. `\tan` contains a `t`,
 * `\operatorname{sort}` contains two, and `v_{tfdp}` contains one inside a
 * subscript that is part of a different name entirely — so this walks the
 * string the way a lexer would rather than matching against it.
 */

/** A Desmos identifier: one letter, then an optional subscript. */
export const IDENTIFIER_SOURCE = String.raw`[A-Za-z](?:_(?:\{[A-Za-z0-9]*\}|[A-Za-z0-9]))?`;

const IDENTIFIER_AT_START = new RegExp(`^${IDENTIFIER_SOURCE}`);
const COMMAND_AT_START = /^\\([A-Za-z]+)/;

/**
 * One spelling for an identifier, so `a_{1}` and `a_1` are the same name.
 *
 * MathQuill writes the braced form and a hand-typed expression may not, and the
 * two have to agree or a field would reference a slider the environment holds
 * under the other spelling and fails to find.
 */
export const canonicalIdentifier = (name: string) =>
  name.replace(/_\{([A-Za-z0-9]*)\}/, "_$1");

/** Where one identifier sits in the source, and what it is called. */
export interface IdentifierOccurrence {
  /** Canonical name. */
  name: string;
  /** Index of the first character, and one past the last. */
  start: number;
  end: number;
}

/** The index just past a brace group starting at `open`, or `open` if unpaired. */
function skipBraceGroup(latex: string, open: number) {
  let depth = 0;
  for (let i = open; i < latex.length; i++) {
    if (latex[i] === "{") depth++;
    else if (latex[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return open;
}

/**
 * Every identifier in the expression, in order.
 *
 * Backslash commands are skipped, and so is the body of `\operatorname{...}`,
 * because the letters spelling a function's name are not variables — without
 * that, `\operatorname{sort}` would report `s`, `o`, `r` and `t`.
 */
export function scanIdentifiers(latex: string): IdentifierOccurrence[] {
  const found: IdentifierOccurrence[] = [];
  let i = 0;
  while (i < latex.length) {
    if (latex[i] === "\\") {
      const command = COMMAND_AT_START.exec(latex.slice(i));
      if (command === null) {
        // An escaped character: `\{`, `\}`, or MathQuill's escaped space.
        i += 2;
        continue;
      }
      i += command[0].length;
      if (command[1] === "operatorname" && latex[i] === "{") {
        i = skipBraceGroup(latex, i);
      }
      continue;
    }
    if (/[A-Za-z]/.test(latex[i])) {
      const [text] = IDENTIFIER_AT_START.exec(latex.slice(i))!;
      found.push({
        name: canonicalIdentifier(text),
        start: i,
        end: i + text.length,
      });
      i += text.length;
      continue;
    }
    i++;
  }
  return found;
}

/** The distinct names an expression mentions. */
export function identifierNames(latex: string): Set<string> {
  return new Set(scanIdentifiers(latex).map((found) => found.name));
}

/** Whether the expression mentions this name at all. */
export function mentions(latex: string, name: string) {
  const wanted = canonicalIdentifier(name);
  return scanIdentifiers(latex).some((found) => found.name === wanted);
}

/**
 * Replaces every occurrence of one identifier with another.
 *
 * Used to move a component off `t` on its way into the expression list, because
 * `t` is bound inside the parametrics that draw the arrows and a global one
 * would be shadowed there. Rewriting the occurrences this scanner found — never
 * a string replace — is what keeps `\tan` and `v_{tfdt}` intact.
 */
export function renameIdentifier(latex: string, from: string, to: string) {
  const wanted = canonicalIdentifier(from);
  const occurrences = scanIdentifiers(latex).filter(
    (found) => found.name === wanted
  );
  if (occurrences.length === 0) return latex;
  let out = "";
  let cursor = 0;
  for (const occurrence of occurrences) {
    out += latex.slice(cursor, occurrence.start) + to;
    cursor = occurrence.end;
  }
  return out + latex.slice(cursor);
}
