import { EditorState } from "@codemirror/state";
import Controller from "../Controller";
import "./editor.css";
// Basic editor extensions
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { history, historyKeymap } from "@codemirror/history";
import { foldGutter, foldKeymap } from "@codemirror/fold";
import { indentOnInput } from "@codemirror/language";
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/gutter";
import { defaultKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/matchbrackets";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/closebrackets";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { commentKeymap } from "@codemirror/comment";
import { defaultHighlightStyle } from "@codemirror/highlight";
// Language extension
import { TextMode } from "../lezer/index";
import { linter } from "@codemirror/lint";
import { Calc } from "globals/window";

const scrollTheme = EditorView.theme({
  "&": {
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

export function initView(controller: Controller) {
  const [errors, text] = controller.getInitialText();

  if (errors) {
    Calc.controller._showToast({
      message:
        "Automatic conversion to text encountered errors in some expressions.",
      undoCallback: () => {
        controller.toggleTextMode();
      },
    });
  }

  const startState = EditorState.create({
    doc: text,
    extensions: [
      EditorView.updateListener.of(controller.onEditorUpdate.bind(controller)),
      // linter, showing errors
      // The linter is also the entry point to evaluation
      linter(controller.doLint.bind(controller), { delay: 250 }),
      // line numbers and gutter
      lineNumbers(),
      highlightActiveLineGutter(),
      // undo/redo history
      history(),
      // fold using arrow in the gutter
      foldGutter(),
      // use custom DOM to support multiple selection ranges
      drawSelection(),
      // allow multiple selection ranges
      EditorState.allowMultipleSelections.of(true),
      // draw cursor at drop position when something is dragged
      // TODO: override vanilla image drop to support dropping images as text
      dropCursor(),
      // reindent (dedent) based on languageData.indentOnInput
      // specifically, it reindents after },),]
      indentOnInput(),
      defaultHighlightStyle.fallback,
      // show matching brackets
      // TODO: add empty content parse node to support proper matching on (())
      //  It may also help with partial expressions
      bracketMatching(),
      // enable automatic close brackets
      closeBrackets(),
      autocompletion(),
      // highlight the active line
      highlightActiveLine(),
      // highlight text that matches the selection
      highlightSelectionMatches(),
      keymap.of([
        // delete both brackets in the pair if the first gets backspaced on
        ...closeBracketsKeymap,
        // standard keybindings
        ...defaultKeymap,
        // Ctrl+F to search, and more
        ...searchKeymap,
        // Ctrl+Z to undo, etc.
        ...historyKeymap,
        // fold using keybind Ctrl-Shift-[ and similar
        ...foldKeymap,
        // comment using Ctrl+/.
        // TODO: avoid collision with keybinding list from vanilla Desmos
        ...commentKeymap,
        // Ctrl+Space to start completion
        ...completionKeymap,
      ]),
      scrollTheme,
      // language support
      TextMode(),
    ],
  });

  return new EditorView({
    state: startState,
    parent: document.body,
  });
}
