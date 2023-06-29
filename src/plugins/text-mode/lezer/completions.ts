import TextMode from "..";
import { AnyHydrated, AnyHydratedValue } from "../down/style/Hydrated";
import * as Defaults from "../down/style/defaults";
import { getIndentation } from "../modify";
import { exprToTextString } from "../up/astToText";
import { childLatexToAST } from "../up/augToAST";
import {
  Completion,
  CompletionContext,
  pickedCompletion,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SyntaxNode } from "@lezer/common";

function macroExpandWithSelection(
  before: string,
  selString: string,
  after: string
) {
  return (
    view: EditorView,
    completion: Completion,
    from: number,
    to: number
  ) => {
    const indentation = getIndentation(view, from);
    if (indentation.length > 0) {
      before = before.replace(/\n/g, "\n" + indentation);
      selString = selString.replace(/\n/g, "\n" + indentation);
      after = after.replace(/\n/g, "\n" + indentation);
    }
    view.dispatch({
      changes: [{ from, to, insert: before + selString + after }],
      annotations: pickedCompletion.of(completion),
      selection: EditorSelection.range(
        from + before.length,
        from + before.length + selString.length
      ),
    });
  };
}

const FOLDER_COMPLETIONS: Completion[] = [
  {
    type: "keyword",
    label: "table",
    apply: macroExpandWithSelection(
      "table {\n  ",
      "x1",
      " = []\n  \n  y1 = []\n}"
    ),
  },
  {
    type: "keyword",
    label: "image",
    apply: macroExpandWithSelection(
      'image "',
      "Black Pixel",
      `" @{\n  url: ${JSON.stringify(
        Defaults.image.url
      )},\n  width: 10,\n  height: 10,\n  center: (0, 0),\n}`
    ),
  },
  {
    type: "keyword",
    label: "ticker",
    apply: macroExpandWithSelection("ticker ", "a -> a+1", ` @{ minStep: 0 }`),
  },
];

const PROGRAM_COMPLETIONS: Completion[] = [
  {
    type: "keyword",
    label: "folder",
    apply: macroExpandWithSelection('folder "', "title", '" {}'),
  },
  ...FOLDER_COMPLETIONS,
];

export function completions(controller: TextMode, context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (word === null || (word.from === word.to && !context.explicit))
    return null;
  const tree = syntaxTree(context.state);
  const parent = tree.resolve(context.pos);
  return {
    validFor: /^\w*$/,
    from: word.from,
    options:
      parent.name === "BlockInner" && parent.parent!.name === "Folder"
        ? FOLDER_COMPLETIONS
        : parent.name === "Program"
        ? PROGRAM_COMPLETIONS
        : parent.name === "StyleMapping" || parent.name === "MappingEntry"
        ? styleCompletions(controller, parent)
        : [],
  };
}

/**
 * parents of StyleMapping can be
 *   ExprStatement
 *   Table . BlockInner . ExprStatement (table column)
 *   Table
 *   Image
 *   Text
 *   Folder
 *   Settings
 *   StyleMapping . MappingEntry
 */
function styleCompletions(
  controller: TextMode,
  node: SyntaxNode
): Completion[] {
  const defaults =
    node.name === "MappingEntry"
      ? styleDefaults(controller, node.parent!)
      : styleDefaults(controller, node);
  return styleCompletionsFromDefaults(defaults);
}

function styleDefaults(controller: TextMode, node: SyntaxNode): AnyHydrated {
  if (
    node.name === "ExprStatement" &&
    node.parent?.name === "BlockInner" &&
    node.parent.parent?.name === "Table"
  ) {
    return Defaults.column;
  }
  switch (node.name) {
    case "ExprStatement":
      // TODO: check polar and other stuff
      return Defaults.nonpolarExpression;
    case "Table":
      return Defaults.table;
    case "Image":
      return Defaults.image;
    case "Text":
      return Defaults.text;
    case "Folder":
      return Defaults.folder;
    case "Settings":
      return Defaults.settings;
    case "Ticker":
      return Defaults.ticker;
    case "StyleMapping":
      return styleDefaults(controller, node.parent!);
    case "MappingEntry": {
      const id = node.getChild("Identifier")!;
      const key = controller.view!.state.doc.sliceString(id.from, id.to);
      return styleDefaults(controller, node.parent!)[key as keyof AnyHydrated];
    }
    default:
      throw Error(`Unexpected node type as parent of style: ${node.name}`);
  }
}

function styleCompletionsFromDefaults(defaults: AnyHydrated): Completion[] {
  const completions = [];
  for (const key in defaults) {
    const value = defaults[key as keyof AnyHydrated] as AnyHydratedValue;
    completions.push({
      type: "property",
      label: key,
      apply:
        value === null
          ? macroExpandWithSelection(key + ": ", "", ",")
          : typeof value === "object"
          ? "type" in value
            ? macroExpandWithSelection(
                key + ": ",
                exprToTextString(childLatexToAST(value)),
                ","
              )
            : macroExpandWithSelection(key + ": @{ ", "", " },")
          : typeof value === "string"
          ? macroExpandWithSelection(
              key + ': "',
              // string stringify will always start and end with `"`
              JSON.stringify(value).slice(1, -1),
              '",'
            )
          : // I don't know if this last case is reachable
            macroExpandWithSelection(key + ": ", JSON.stringify(value), ","),
    });
  }
  return completions;
}
