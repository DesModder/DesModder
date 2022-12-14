import { errorInBlock, syntaxError } from "./errors";
import { ReplacementToken, tokenizeReplacement } from "./tokenize";
import { Token } from "js-tokens";

export interface ReplacementRule {
  module: string;
  from: Token[];
  to: Token[];
}

export default function parseReplacement(
  replacementString: string
): ReplacementRule[] {
  const tokens = tokenizeReplacement(replacementString);
  if (tokens[0].tag !== "heading" || tokens[0].depth !== 1)
    syntaxError("First line must be a # Heading");
  const rules: ReplacementRule[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tag === "emph" && token.command === "module") {
      const prevToken = tokens[i - 1];
      if (prevToken.tag !== "heading")
        syntaxError("Module command must be preceded by a heading");
      const nextHeadingIndex = tokens.findIndex(
        (t, j) => j > i && t.tag === "heading" && t.depth <= prevToken.depth
      );
      const blockEndIndex =
        nextHeadingIndex < 0 ? tokens.length : nextHeadingIndex;
      const block = tokens.slice(i + 1, blockEndIndex);
      rules.push(parseBlock(prevToken, token, block));
      i = blockEndIndex;
    } else if (token.tag === "emph") {
      syntaxError(`Command out of place: *${token.command}*`);
    }
  }
  return rules;
}

/**
 * Parse a block to a replacement rule. The tokens array must only contain
 * headings with depth greater than heading.depth. This is not yet implemented
 * though; we require the the tokens array to contain no headings. In the
 * future, headings can represent scoping or something, so for future-
 * compatibility, just disallow all headings.
 **/
function parseBlock(
  heading: ReplacementToken & { tag: "heading" },
  moduleCommand: ReplacementToken & { tag: "emph" },
  tokens: ReplacementToken[]
): ReplacementRule {
  let from: Token[] | null = null;
  let to: Token[] | null = null;
  if (moduleCommand.args.length === 0)
    errorInBlock(`Command *module* must have at least one argument`, heading);
  if (moduleCommand.args.length > 1)
    errorInBlock(
      `Command *module* does not yet support more than one argument`,
      heading
    );
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token.tag === "heading") {
      errorInBlock("Subheadings not yet implemented", heading);
    } else if (token.tag === "emph") {
      const nextToken = tokens[i + 1];
      if (nextToken === undefined || nextToken.tag !== "code")
        errorInBlock(
          `Command *${token.command}* must be followed by a code block`,
          heading
        );
      if (token.command === "from") from = nextToken.value;
      else if (token.command === "to") to = nextToken.value;
      else errorInBlock("Command must be *from* or *to*", heading);
      i += 2;
    } else {
      i++;
    }
  }
  if (from === null || to === null)
    errorInBlock(`Command *from* or *to* is missing`, heading);
  return {
    module: moduleCommand.args[0],
    from,
    to,
  };
}
