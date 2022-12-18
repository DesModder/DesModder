import { errorInBlock, syntaxError } from "./errors";
import {
  PatternToken,
  ReplacementToken,
  tokenizeReplacement,
} from "./tokenize";

export interface ReplacementRule {
  module: string;
  plugin: string;
  heading: string;
  commands: Command[];
}

export type Command =
  | {
      tag: "find";
      returns?: string;
      code: PatternToken[];
      inside?: string;
    }
  | {
      tag: "replace";
      arg: string;
      code: PatternToken[];
    };

export default function parseReplacement(
  replacementString: string
): ReplacementRule[] {
  const tokens = tokenizeReplacement(replacementString);
  if (tokens[0].tag !== "heading" || tokens[0].depth !== 1)
    syntaxError("First line must be a # Heading");
  if (
    tokens[1].tag !== "emph" ||
    tokens[1].command !== "plugin" ||
    tokens[1].args.length !== 1
  )
    syntaxError("Second line must be *plugin* `plugin-name`");
  const pluginName = tokens[1].args[0];
  const rules: ReplacementRule[] = [];
  for (let i = 2; i < tokens.length; i++) {
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
      rules.push(parseBlock(prevToken, token, block, pluginName));
      i = blockEndIndex;
    } else if (token.tag === "emph") {
      syntaxError(
        `Command out of place: *${token.command}*.` +
          ` Did you forget a *module* command?`
      );
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
  tokens: ReplacementToken[],
  plugin: string
): ReplacementRule {
  const rule: ReplacementRule = {
    module: moduleCommand.args[0],
    plugin,
    heading: heading.text,
    commands: [],
  };
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
      rule.commands.push(getCommand(token, nextToken, heading));
      i += 2;
    } else {
      i++;
    }
  }
  if (rule.commands.filter((x) => x.tag === "replace").length !== 1)
    errorInBlock("Only one *replace* command is currently supported", heading);
  return rule;
}

function getCommand(
  token: ReplacementToken & { tag: "emph" },
  nextToken: ReplacementToken & { tag: "code" },
  heading: ReplacementToken & { tag: "heading" }
): Command {
  switch (token.command) {
    case "replace":
      if (token.args.length !== 1)
        errorInBlock(
          `Command *${token.command}* takes exactly one argument`,
          heading
        );
      return {
        tag: "replace",
        arg: token.args[0],
        code: nextToken.value,
      };
    case "find":
      if (token.args.length > 1)
        errorInBlock(`Command *find* takes at most one argument`, heading);
      return {
        tag: "find",
        returns: token.returns,
        code: nextToken.value,
        inside: token.args[0],
      };
    default:
      errorInBlock(`Invalid command: *${token.command}*`, heading);
  }
}
