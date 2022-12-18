import { errorInBlock, syntaxError } from "./errors";
import {
  PatternToken,
  ReplacementToken,
  tokenizeReplacement,
} from "./tokenize";

export type Block = DefineBlock | ModuleBlock;

interface BaseBlock {
  heading: string;
  commands: Command[];
}

export interface DefineBlock extends BaseBlock {
  tag: "DefineBlock";
  commandName: string;
}

export interface ModuleBlock extends BaseBlock {
  tag: "ModuleBlock";
  module: string;
  plugin: string;
}

export interface Command {
  command: string;
  returns?: string;
  args: string[];
  patternArg?: PatternToken[];
}

export default function parseFile(fileString: string): Block[] {
  const tokens = tokenizeReplacement(fileString);
  if (tokens[0].tag !== "heading" || tokens[0].depth !== 1)
    syntaxError("First line must be a # Heading");
  if (
    tokens[1].tag !== "emph" ||
    tokens[1].command !== "plugin" ||
    tokens[1].args.length !== 1
  )
    syntaxError("Second line must be *plugin* `plugin-name`");
  const pluginName = tokens[1].args[0];
  const rules: Block[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tag === "emph" && ["module", "define"].includes(token.command)) {
      const prevToken = tokens[i - 1];
      if (prevToken.tag !== "heading")
        syntaxError(
          `Block-starter command *${token.command}* must be preceded by a heading`
        );
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
          ` Did you forget a *module* or *define* command?`
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
  blockStarterCommand: ReplacementToken & { tag: "emph" },
  tokens: ReplacementToken[],
  plugin: string
): Block {
  if (blockStarterCommand.args.length !== 1)
    errorInBlock(
      `Command *${blockStarterCommand.command}* must have exactly one argument`,
      heading
    );
  const commands: Command[] = [];
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
      commands.push(getCommand(token, nextToken));
      i += 2;
    } else {
      i++;
    }
  }
  return blockStarterCommand.command === "module"
    ? {
        tag: "ModuleBlock",
        heading: heading.text,
        commands,
        plugin,
        module: blockStarterCommand.args[0],
      }
    : {
        tag: "DefineBlock",
        heading: heading.text,
        commands,
        commandName: blockStarterCommand.args[0],
      };
}

function getCommand(
  token: ReplacementToken & { tag: "emph" },
  nextToken: ReplacementToken
): Command {
  return {
    command: token.command,
    returns: token.returns,
    args: token.args,
    patternArg: nextToken.tag === "code" ? nextToken.value : undefined,
  };
}
