import {
  Completion,
  CompletionContext,
  pickedCompletion,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

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

const completionsMap: { [key: string]: Completion[] | undefined } = {
  Program: [
    {
      type: "keyword",
      label: "folder",
      apply: macroExpandWithSelection('folder "', "title", '" {}'),
    },
    {
      type: "keyword",
      label: "table",
      apply: macroExpandWithSelection(
        "table {\n  ",
        "x1",
        " = [ ]\n  y1 = [ ]\n}"
      ),
    },
    {
      type: "keyword",
      label: "image",
      apply: macroExpandWithSelection(
        'image "',
        "name",
        '" "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdjYGBg+A8AAQQBAHAgZQsAAAAASUVORK5CYII="' +
          "\n  @{\n    width: 10,\n    height: 10,\n    center: (0,0),\n  }"
      ),
    },
  ],
  StyleMapping: [
    // TODO: generalize for all valid styles with their defaults
    // TODO: determine valid options based on style mapping path from root
    {
      type: "property",
      label: "color",
      apply: macroExpandWithSelection("color: ", "BLUE", ""),
    },
    {
      type: "property",
      label: "hidden",
      apply: macroExpandWithSelection("hidden: ", "true", ""),
    },
  ],
};

export function completions(context: CompletionContext) {
  let word = context.matchBefore(/\w*/);
  if (word === null || (word.from == word.to && !context.explicit)) return null;
  const tree = syntaxTree(context.state);
  const parentName = tree.resolve(context.pos).name;
  return {
    // TODO: validFor does not seem to be preventing re-calling this function
    validFor: /^\w*$/,
    from: word.from,
    options: completionsMap[parentName] ?? [],
  };
}
