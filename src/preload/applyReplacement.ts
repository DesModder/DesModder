import jsTokens, { Token } from "js-tokens";

export default function applyReplacement(replacement: string, fn: Function) {
  // use `Function` instead of `eval` to force treatment as an expression
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return Function(
    "return " +
      applyStringReplacement(
        parseReplacement(replacement),
        Array.from(jsTokens(fn.toString()))
      )
        .map((t) => t.value)
        .join("")
  )();
}

interface ReplacementRule {
  from: Token[];
  to: Token[];
}

function applyStringReplacement(
  replacement: ReplacementRule,
  str: Token[]
): Token[] {
  let found = false;
  const output: Token[] = [];
  for (let i = 0; i < str.length; ) {
    if (patternTest(replacement.from, str, i)) {
      if (found) {
        console.warn(
          "Duplicate replacement; ignoring it, but this might be a bug"
        );
        break;
      }
      found = true;
      output.push(...replacement.to);
      i += replacement.from.length;
    } else {
      output.push(str[i]);
      i++;
    }
  }
  if (!found) console.warn("Replacement not found. Uh oh?");
  return output;
}

function patternTest(
  pattern: Token[],
  str: Token[],
  startIndex: number
): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const expectedToken = pattern[i];
    const strIndex = startIndex + i;
    const foundToken = str[strIndex];
    if (
      foundToken === undefined ||
      foundToken.type !== expectedToken.type ||
      foundToken.value !== expectedToken.value
    )
      return false;
  }
  return true;
}

function parseReplacement(replacementString: string): ReplacementRule {
  const lines = replacementString
    .split(/\n/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (
    lines.length !== 8 ||
    lines[0] !== "From:" ||
    lines[1] !== "```js" ||
    lines[3] !== "```" ||
    lines[4] !== "To:" ||
    lines[5] !== "```js" ||
    lines[7] !== "```"
  )
    throw new Error("Replacement syntax error");
  return {
    from: Array.from(jsTokens(lines[2])),
    to: Array.from(jsTokens(lines[6])),
  };
}
