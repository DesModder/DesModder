import { ReplacementError } from "./errors";
import {
  PatternToken,
  ReplacementToken,
  tokenizeReplacement,
} from "./tokenize";

export interface Block {
  filename: string;
  heading: string;
  commands: Command[];
  modules: string[];
  plugins: string[];
  replaceCommands: Command[];
  workerOnly: boolean;
  alternative: Block | undefined;
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
  if (tokens[1].tag !== "emph" || tokens[1].command !== "plugin")
    throw new ReplacementError("Second line must be *plugin* `plugin-name`");
  const plugins = tokens[1].args;
  const rules: Block[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tag === "emph" && token.command === "module") {
      const prevToken = tokens[i - 1];
      if (prevToken.tag !== "heading")
        throw new ReplacementError(
          `*module* command must be preceded by a heading`
        );
      const nextHeadingIndex = tokens.findIndex(
        (t, j) => j > i && t.tag === "heading" && t.depth <= prevToken.depth
      );
      const blockEndIndex =
        nextHeadingIndex < 0 ? tokens.length : nextHeadingIndex;
      const block = tokens.slice(i + 1, blockEndIndex);
      rules.push(parseBlock(prevToken, token, block, plugins, filename));
      i = blockEndIndex;
    } else if (token.tag === "emph") {
      throw new ReplacementError(
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
  start: ReplacementToken & { tag: "emph" },
  tokens: ReplacementToken[],
  plugins: string[],
  filename: string
): Block {
  if (start.args.length === 0)
    throw new ReplacementError(
      `Command *module* must have at least one argument`
    );
  const commands: Command[] = [];
  let alternative: Block | undefined;
  let workerOnly = false;
  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token.tag === "heading") {
      const next = tokens[i + 1];
      if (
        token.text.includes("Alternative") &&
        next.tag === "emph" &&
        next.command === "module"
      ) {
        alternative = parseBlock(
          token,
          next,
          tokens.slice(i + 2),
          plugins,
          filename
        );
        break;
      } else throw new ReplacementError("Subheadings not yet implemented");
    } else if (token.tag === "emph" && token.command === "worker_only") {
      workerOnly = true;
      i++;
    } else if (token.tag === "emph") {
      const nextToken = tokens[i + 1];
      const code = nextToken?.tag === "code" ? nextToken : undefined;
      commands.push(getCommand(token, code));
      i += code !== undefined ? 2 : 1;
    } else {
      i++;
    }
  }
  return {
    heading: heading.text,
    filename,
    commands: commands.filter((x) => x.command !== "replace"),
    replaceCommands: commands.filter((x) => x.command === "replace"),
    plugins,
    modules: start.args,
    workerOnly,
    alternative,
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
