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
import {
  indentOnInput,
  foldGutter,
  bracketMatching,
  syntaxHighlighting,
  foldKeymap,
} from "@codemirror/language";
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  closeBrackets,
  autocompletion,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { defaultHighlightStyle } from "@codemirror/language";
// Language extension
import { TextMode } from "../lezer/index";
import { linter } from "@codemirror/lint";
import { Calc } from "globals/window";
import { checkboxPlugin } from "./plugins/checkboxWidget";

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
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
        // includes comment using Ctrl+/.
        ...defaultKeymap,
        // Ctrl+F to search, and more
        ...searchKeymap,
        // Ctrl+Z to undo, etc.
        ...historyKeymap,
        // fold using keybind Ctrl-Shift-[ and similar
        ...foldKeymap,
        // Ctrl+Space to start completion
        ...completionKeymap,
      ]),
      scrollTheme,
      // language support
      TextMode(controller),
      // Text mode plugins
      checkboxPlugin,
    ],
  });

  return new EditorView({
    state: startState,
    parent: document.body,
  });
}
