import { ReplacementRule } from "./parse";
import jsTokens, { Token } from "js-tokens";

export default function applyReplacement(
  replacement: ReplacementRule,
  fn: Function
) {
  const newCode = applyStringReplacement(
    replacement,
    Array.from(jsTokens(fn.toString()))
  )
    .map((t) => t.value)
    .join("");
  // use `Function` instead of `eval` to force treatment as an expression
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return Function("return " + newCode)();
}

function applyStringReplacement(
  replacement: ReplacementRule,
  str: Token[]
): Token[] {
  let found = false;
  const output: Token[] = [];
  for (let i = 0; i < str.length; ) {
    const match = patternMatch(replacement.from, str, i);
    if (match !== null) {
      if (found) {
        console.error(
          "Duplicate replacement; ignoring it, but this might be a bug"
        );
        break;
      }
      found = true;
      output.push(
        ...replacement.to.map((token) => {
          if (token.type === "IdentifierName" && token.value.startsWith("$")) {
            const id = match.capturedIds.get(token.value);
            if (id === undefined)
              throw new Error(
                `Programming error: identifier ${token.value} in "to" not found in "from"`
              );
            return id;
          } else return token;
        })
      );
      i += match.length;
    } else {
      output.push(str[i]);
      i++;
    }
  }
  if (!found) console.error("Replacement not found. Uh oh?");
  return output;
}

type MatchResult = {
  capturedIds: Map<string, Token>;
  startIndex: number;
  length: number;
} | null;

/** Return null if not matching, or a map from $identifier to dsmId if found. */
function patternMatch(
  pattern: Token[],
  str: Token[],
  startIndex: number
): MatchResult {
  const captured = new Map<string, Token>();
  let patternIndex = 0;
  let strIndex = startIndex;
  while (patternIndex < pattern.length) {
    const expectedToken = pattern[patternIndex];
    const foundToken = str[strIndex];
    if (foundToken === undefined) return null;
    if (isIgnoredWhitespace(expectedToken)) {
      patternIndex++;
      continue;
    }
    // ignore whitespace, except at the start of a match
    if (isIgnoredWhitespace(foundToken) && patternIndex > 0) {
      strIndex++;
      continue;
    }
    if (expectedToken.type !== foundToken.type) return null;
    if (
      expectedToken.type === "IdentifierName" &&
      expectedToken.value.startsWith("$")
    ) {
      const currValue = captured.get(expectedToken.value);
      if (currValue === undefined)
        captured.set(expectedToken.value, foundToken);
      else if (foundToken.value !== currValue.value)
        throw new Error(
          "Pattern error: Same $idPattern matches two different tokens"
        );
    } else if (expectedToken.value !== foundToken.value) return null;
    patternIndex++;
    strIndex++;
  }
  return {
    capturedIds: captured,
    startIndex,
    length: strIndex - startIndex,
  };
}

/** Is this token ignored for the purpose of matching? */
function isIgnoredWhitespace(token: Token) {
  return token.type === "WhiteSpace" || token.type === "LineTerminatorSequence";
}
