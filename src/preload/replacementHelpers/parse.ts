import { ReplacementError, tryWithErrorContext } from "./errors";
import {
  PatternToken,
  ReplacementToken,
  tokenizeReplacement,
} from "./tokenize";

export type Block = DefineBlock | ModuleBlock;

interface BaseBlock {
  filename: string;
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
  replaceCommand: Command;
}

export interface Command {
  command: string;
  returns?: string;
  args: string[];
  patternArg?: PatternToken[];
}

export default function parseFile(
  fileString: string,
  filename: string
): Block[] {
  const tokens = tokenizeReplacement(fileString);
  if (tokens[0].tag !== "heading" || tokens[0].depth !== 1)
    throw new ReplacementError("First line must be a # Heading");
  if (
    tokens[1].tag !== "emph" ||
    tokens[1].command !== "plugin" ||
    tokens[1].args.length !== 1
  )
    throw new ReplacementError("Second line must be *plugin* `plugin-name`");
  const pluginName = tokens[1].args[0];
  const rules: Block[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tag === "emph" && ["module", "define"].includes(token.command)) {
      const prevToken = tokens[i - 1];
      if (prevToken.tag !== "heading")
        throw new ReplacementError(
          `Block-starter command *${token.command}* must be preceded by a heading`
        );
      const nextHeadingIndex = tokens.findIndex(
        (t, j) => j > i && t.tag === "heading" && t.depth <= prevToken.depth
      );
      const blockEndIndex =
        nextHeadingIndex < 0 ? tokens.length : nextHeadingIndex;
      const block = tokens.slice(i + 1, blockEndIndex);
      tryWithErrorContext(
        () =>
          rules.push(parseBlock(prevToken, token, block, pluginName, filename)),
        { message: `parsing block '${prevToken.text}'`, filename }
      );
      i = blockEndIndex;
    } else if (token.tag === "emph") {
      throw new ReplacementError(
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
  plugin: string,
  filename: string
): Block {
  if (blockStarterCommand.args.length !== 1)
    throw new ReplacementError(
      `Command *${blockStarterCommand.command}* must have exactly one argument`
    );
  const commands: Command[] = [];
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token.tag === "heading") {
      throw new ReplacementError("Subheadings not yet implemented");
    } else if (token.tag === "emph") {
      const nextToken = tokens[i + 1];
      const code = nextToken?.tag === "code" ? nextToken : undefined;
      commands.push(getCommand(token, code));
      i += code !== undefined ? 2 : 1;
    } else {
      i++;
    }
  }
  const expectedReplaces = blockStarterCommand.command === "module" ? 1 : 0;
  const numReplaces = commands.filter((x) => x.command === "replace").length;
  if (numReplaces !== expectedReplaces)
    throw new ReplacementError(
      `Block ${blockStarterCommand.command} expects ${expectedReplaces} ` +
        `*replace* command(s) but got ${numReplaces}`
    );
  if (
    blockStarterCommand.command === "module" &&
    commands.findIndex((x) => x.command === "replace") < commands.length - 1
  )
    throw new ReplacementError(
      `Module block should have *replace* command at end, but found one in the middle`
    );
  const base = {
    heading: heading.text,
    filename,
  };
  return blockStarterCommand.command === "module"
    ? {
        tag: "ModuleBlock",
        ...base,
        commands: commands.slice(0, -1),
        replaceCommand: commands[commands.length - 1],
        plugin,
        module: blockStarterCommand.args[0],
      }
    : {
        tag: "DefineBlock",
        ...base,
        commands,
        commandName: blockStarterCommand.args[0],
      };
}

function getCommand(
  token: ReplacementToken & { tag: "emph" },
  nextToken: (ReplacementToken & { tag: "code" }) | undefined
): Command {
  return {
    command: token.command,
    returns: token.returns,
    args: token.args,
    patternArg: nextToken?.value,
  };
}
