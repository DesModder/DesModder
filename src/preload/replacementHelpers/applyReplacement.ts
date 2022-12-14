import { ReplacementRule } from "./parseReplacement";
import jsTokens, { Token } from "js-tokens";

export default function applyReplacement(
  replacement: ReplacementRule,
  fn: Function
) {
  // use `Function` instead of `eval` to force treatment as an expression
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return Function(
    "return " +
      applyStringReplacement(replacement, Array.from(jsTokens(fn.toString())))
        .map((t) => t.value)
        .join("")
  )();
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
            const matched = match.get(token.value);
            if (matched === undefined)
              throw new Error(
                `Programming error: identifier ${token.value} in "to" not found in "from"`
              );
            return matched;
          } else return token;
        })
      );
      i += replacement.from.length;
    } else {
      output.push(str[i]);
      i++;
    }
  }
  if (!found) console.error("Replacement not found. Uh oh?");
  return output;
}

/** Return null if not matching, or a map from $identifier to dsmId if found. */
function patternMatch(
  pattern: Token[],
  str: Token[],
  startIndex: number
): Map<string, Token> | null {
  const resultMap = new Map<string, Token>();
  for (let i = 0; i < pattern.length; i++) {
    const expectedToken = pattern[i];
    const strIndex = startIndex + i;
    const foundToken = str[strIndex];
    if (foundToken === undefined || expectedToken.type !== foundToken.type)
      return null;
    if (
      expectedToken.type === "IdentifierName" &&
      expectedToken.value.startsWith("$")
    ) {
      const currValue = resultMap.get(expectedToken.value);
      if (currValue === undefined)
        resultMap.set(expectedToken.value, foundToken);
      else if (foundToken.value !== currValue.value)
        throw new Error(
          "Pattern error: Same $idPattern matches two different tokens"
        );
    } else if (expectedToken.value !== foundToken.value) return null;
  }
  return resultMap;
}
